package main

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ProxyHandler routes incoming HTTP traffic to corresponding agent instances.
type ProxyHandler struct {
	scheduler       *Scheduler
	roundRobinIndex map[string]int
	rrLock          sync.Mutex
}

// NewProxyHandler creates a new reverse proxy router associated with a scheduler.
func NewProxyHandler(scheduler *Scheduler) *ProxyHandler {
	return &ProxyHandler{
		scheduler:       scheduler,
		roundRobinIndex: make(map[string]int),
	}
}

// ServeHTTP implements the http.Handler interface, routing and proxying incoming requests.
func (ph *ProxyHandler) ServeHTTP(responseWriter http.ResponseWriter, request *http.Request) {
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

	// 1. Ensure the agent is deployed and active (scale up from 0 to 1 replica if scaled down).
	// This blocks until the spawned agent's health check returns successful status.
	err := ph.scheduler.EnsureActive(agentName)
	if err != nil {
		fmt.Printf("[Proxy] Error: Failed to activate agent %s: %v\n", agentName, err)
		http.Error(responseWriter, fmt.Sprintf("Failed to activate agent %s: %v", agentName, err), http.StatusServiceUnavailable)
		return
	}

	// 2. Retrieve the agent's deployment metadata.
	deployment, exists := ph.scheduler.GetDeployment(agentName)
	if !exists {
		http.Error(responseWriter, fmt.Sprintf("Agent %s not found", agentName), http.StatusNotFound)
		return
	}

	deployment.lock.Lock()
	deployment.LastTrafficTime = time.Now() // Record activity for autoscaling monitor
	deployment.lock.Unlock()

	// 3. Gather the list of healthy instances for this agent.
	deployment.lock.RLock()
	var healthyInstances []*AgentInstance
	for _, inst := range deployment.Instances {
		inst.lock.Lock()
		if inst.Status == StatusHealthy {
			healthyInstances = append(healthyInstances, inst)
		}
		inst.lock.Unlock()
	}
	deployment.lock.RUnlock()

	if len(healthyInstances) == 0 {
		http.Error(responseWriter, "No healthy instances available for agent", http.StatusServiceUnavailable)
		return
	}

	// 4. Select an instance using round-robin scheduling.
	ph.rrLock.Lock()
	currentIndex := ph.roundRobinIndex[agentName]
	selectedInstance := healthyInstances[currentIndex%len(healthyInstances)]
	ph.roundRobinIndex[agentName] = (currentIndex + 1) % len(healthyInstances)
	ph.rrLock.Unlock()

	// 5. Proxy the HTTP request to the selected instance.
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
	fmt.Printf("[Proxy] Forwarding request: %s %s -> %s%s\n", request.Method, request.URL.Path, targetHostURL, rewrittenPath)

	reverseProxy.ServeHTTP(responseWriter, request)
}
