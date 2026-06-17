package orchestrator

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"
)

// responseWriterInterceptor wraps http.ResponseWriter to capture the HTTP status code.
type responseWriterInterceptor struct {
	http.ResponseWriter
	statusCode int
}

func (rwi *responseWriterInterceptor) WriteHeader(statusCode int) {
	rwi.statusCode = statusCode
	rwi.ResponseWriter.WriteHeader(statusCode)
}

func (rwi *responseWriterInterceptor) Write(b []byte) (int, error) {
	if rwi.statusCode == 0 {
		rwi.statusCode = http.StatusOK
	}
	return rwi.ResponseWriter.Write(b)
}

// ProxyHandler routes incoming HTTP traffic to corresponding agent instances.
type ProxyHandler struct {
	scheduler       *Scheduler
	observability   *ObservabilityManager
	roundRobinIndex map[string]int
	rrLock          sync.Mutex
}

// NewProxyHandler creates a new reverse proxy router associated with a scheduler and observability manager.
func NewProxyHandler(scheduler *Scheduler, observability *ObservabilityManager) *ProxyHandler {
	return &ProxyHandler{
		scheduler:       scheduler,
		observability:   observability,
		roundRobinIndex: make(map[string]int),
	}
}

// ServeHTTP implements the http.Handler interface, routing and proxying incoming requests.
func (ph *ProxyHandler) ServeHTTP(responseWriter http.ResponseWriter, request *http.Request) {
	startTime := time.Now()

	// Paths should match: /proxy/:agent_name/*
	if !strings.HasPrefix(request.URL.Path, "/proxy/") {
		http.Error(responseWriter, "Bad request: proxy requests must begin with /proxy/", http.StatusBadRequest)
		return
	}

	// Extract the agent name from the path.
	pathSuffix := strings.TrimPrefix(request.URL.Path, "/proxy/")
	pathSegments := strings.SplitN(pathSuffix, "/", 2)
	if len(pathSegments) == 0 || pathSegments[0] == "" {
		http.Error(responseWriter, "Bad request: missing agent name in path", http.StatusBadRequest)
		return
	}

	agentName := pathSegments[0]

	// 1. Enforce multi-tenant isolation by reading incoming request headers
	tenantID := request.Header.Get("X-Tenant-ID")
	workspaceID := request.Header.Get("X-Workspace-ID")
	orgID := request.Header.Get("X-Organization-ID")
	if tenantID == "" {
		tenantID = "default_tenant"
	}
	if workspaceID == "" {
		workspaceID = "default_workspace"
	}
	if orgID == "" {
		orgID = "default_org"
	}

	// 2. Ensure the agent is deployed and active (scale up from 0 to 1 replica if scaled down).
	// This blocks until the spawned agent's health check returns successful status.
	err := ph.scheduler.EnsureActive(agentName)
	if err != nil {
		fmt.Printf("[Proxy] Error: Failed to activate agent %s: %v\n", agentName, err)
		http.Error(responseWriter, fmt.Sprintf("Failed to activate agent %s: %v", agentName, err), http.StatusServiceUnavailable)
		return
	}

	// 3. Retrieve the agent's deployment metadata.
	deployment, exists := ph.scheduler.GetDeployment(agentName)
	if !exists {
		http.Error(responseWriter, fmt.Sprintf("Agent %s not found", agentName), http.StatusNotFound)
		return
	}

	deployment.lock.Lock()
	deployment.LastTrafficTime = time.Now() // Record activity for autoscaling monitor
	deployment.lock.Unlock()

	// 4. Resolve routing target version (supporting Canary Deployments)
	deployment.lock.RLock()
	targetVersion := deployment.Manifest.Version
	if deployment.Manifest.Canary != nil {
		canary := deployment.Manifest.Canary
		// Generate weight check using timestamp nanosecond fraction
		diceRoll := float64(time.Now().UnixNano() % 100)
		if diceRoll < canary.Weight {
			targetVersion = canary.Version
			fmt.Printf("[Canary Routing] Dice roll %.1f < %.1f. Routing request to canary version %s\n", diceRoll, canary.Weight, targetVersion)
		} else {
			fmt.Printf("[Canary Routing] Dice roll %.1f >= %.1f. Routing request to main version %s\n", diceRoll, canary.Weight, targetVersion)
		}
	}

	// 5. Gather the list of healthy instances for the target version.
	var healthyInstances []*AgentInstance
	for _, inst := range deployment.Instances {
		inst.lock.Lock()
		if inst.Status == StatusHealthy && inst.Version == targetVersion {
			healthyInstances = append(healthyInstances, inst)
		}
		inst.lock.Unlock()
	}

	// Fallback to any healthy instance if version specific list is empty (prevent service disruption)
	if len(healthyInstances) == 0 {
		for _, inst := range deployment.Instances {
			inst.lock.Lock()
			if inst.Status == StatusHealthy {
				healthyInstances = append(healthyInstances, inst)
			}
			inst.lock.Unlock()
		}
	}
	deployment.lock.RUnlock()

	if len(healthyInstances) == 0 {
		http.Error(responseWriter, "No healthy instances available for agent", http.StatusServiceUnavailable)
		return
	}

	// 6. Select an instance using round-robin scheduling.
	ph.rrLock.Lock()
	currentIndex := ph.roundRobinIndex[agentName]
	selectedInstance := healthyInstances[currentIndex%len(healthyInstances)]
	ph.roundRobinIndex[agentName] = (currentIndex + 1) % len(healthyInstances)
	ph.rrLock.Unlock()

	// 7. Proxy the HTTP request to the selected instance.
	targetHostURL := fmt.Sprintf("http://localhost:%d", selectedInstance.Port)
	parsedTargetURL, err := url.Parse(targetHostURL)
	if err != nil {
		http.Error(responseWriter, "Internal server error parsing target URL", http.StatusInternalServerError)
		return
	}

	// Instantiate the reverse proxy.
	reverseProxy := httputil.NewSingleHostReverseProxy(parsedTargetURL)

	// Rewrite request path: e.g. /proxy/weather-agent/invoke -> /invoke
	prefixToRemove := "/proxy/" + agentName
	rewrittenPath := strings.TrimPrefix(request.URL.Path, prefixToRemove)
	if !strings.HasPrefix(rewrittenPath, "/") {
		rewrittenPath = "/" + rewrittenPath
	}

	request.URL.Path = rewrittenPath
	request.URL.Host = parsedTargetURL.Host
	request.URL.Scheme = parsedTargetURL.Scheme
	request.Header.Set("X-Forwarded-Host", request.Header.Get("Host"))

	// Print proxy event for observability
	fmt.Printf("[Proxy] Forwarding request: %s %s -> %s%s (Tenant: %s)\n", request.Method, request.URL.Path, targetHostURL, rewrittenPath, tenantID)

	// Capture response using interceptor
	interceptor := &responseWriterInterceptor{ResponseWriter: responseWriter}
	reverseProxy.ServeHTTP(interceptor, request)

	// 8. Record observability metrics and costs
	latency := time.Since(startTime)
	success := interceptor.statusCode < 400 || interceptor.statusCode == 0

	// Simulating token tracking (in production, parse from LLM response body/headers)
	inputTokens := 150
	outputTokens := 300
	if inVal := request.Header.Get("X-Tokens-Input"); inVal != "" {
		fmt.Sscanf(inVal, "%d", &inputTokens)
	}
	if outVal := request.Header.Get("X-Tokens-Output"); outVal != "" {
		fmt.Sscanf(outVal, "%d", &outputTokens)
	}

	ph.observability.Record(MetricRecord{
		AgentName:      agentName,
		Version:        selectedInstance.Version,
		Timestamp:      time.Now(),
		Latency:        latency,
		TokensInput:    inputTokens,
		TokensOutput:   outputTokens,
		Success:        success,
		TenantID:       tenantID,
		WorkspaceID:    workspaceID,
		OrganizationID: orgID,
	})
}

