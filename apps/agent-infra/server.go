package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"gopkg.in/yaml.v3"
)

// APIServer manages the REST API endpoints and routes requests to corresponding managers.
type APIServer struct {
	scheduler      *Scheduler
	jobQueue       *JobQueue
	proxy          *ProxyHandler
	nodeManager    *NodeManager
	secretsManager *SecretsManager
	eventBus       *EventBus
	stateStore     *StateStore
	workflowEngine *WorkflowEngine
	observability  *ObservabilityManager
	registry       *AgentRegistry
	marketplace    *AgentMarketplace
}

// NewAPIServer creates a new API server instance with all control plane subsystems.
func NewAPIServer(
	scheduler *Scheduler,
	jobQueue *JobQueue,
	proxy *ProxyHandler,
	nodeManager *NodeManager,
	secretsManager *SecretsManager,
	eventBus *EventBus,
	stateStore *StateStore,
	workflowEngine *WorkflowEngine,
	observability *ObservabilityManager,
	registry *AgentRegistry,
	marketplace *AgentMarketplace,
) *APIServer {
	return &APIServer{
		scheduler:      scheduler,
		jobQueue:       jobQueue,
		proxy:          proxy,
		nodeManager:    nodeManager,
		secretsManager: secretsManager,
		eventBus:       eventBus,
		stateStore:     stateStore,
		workflowEngine: workflowEngine,
		observability:  observability,
		registry:       registry,
		marketplace:    marketplace,
	}
}

// RegisterRoutes registers the handlers onto the ServeMux using modern Go 1.22+ wildcard patterns.
func (s *APIServer) RegisterRoutes(serveMux *http.ServeMux) {
	// Deploy/Undeploy agents
	serveMux.HandleFunc("POST /api/deploy", s.handleDeploy)
	serveMux.HandleFunc("DELETE /api/deploy/{name}", s.handleDeleteDeploy)

	// List deployed agents
	serveMux.HandleFunc("GET /api/agents", s.handleListAgents)

	// Get logs of a specific agent
	serveMux.HandleFunc("GET /api/agents/{name}/logs", s.handleGetLogs)

	// Manually scale an agent's replica count
	serveMux.HandleFunc("POST /api/agents/{name}/scale", s.handleScale)

	// Queue job (async) and query status
	serveMux.HandleFunc("POST /api/agents/{name}/jobs", s.handleCreateJob)
	serveMux.HandleFunc("GET /api/jobs/{id}", s.handleGetJob)

	// --- NEW SUBSYSTEM ENDPOINTS ---

	// Agent Registry
	serveMux.HandleFunc("GET /api/registry", s.handleGetRegistry)
	serveMux.HandleFunc("POST /api/registry/register", s.handleRegisterManifest)

	// Cluster Nodes
	serveMux.HandleFunc("GET /api/nodes", s.handleGetNodes)

	// Secrets Manager
	serveMux.HandleFunc("POST /api/secrets", s.handleSetSecret)
	serveMux.HandleFunc("GET /api/secrets/{namespace}", s.handleGetSecrets)
	serveMux.HandleFunc("DELETE /api/secrets/{namespace}/{key}", s.handleDeleteSecret)

	// Event Bus
	serveMux.HandleFunc("POST /api/events/publish", s.handlePublishEvent)
	serveMux.HandleFunc("POST /api/events/subscribe", s.handleSubscribeTopic)
	serveMux.HandleFunc("GET /api/events/history", s.handleGetEventHistory)

	// State Store
	serveMux.HandleFunc("GET /api/state/{agent}/{key}", s.handleGetState)
	serveMux.HandleFunc("POST /api/state/{agent}/{key}", s.handlePutState)

	// Observability & Costs
	serveMux.HandleFunc("GET /api/observability/metrics", s.handleGetPrometheusMetrics) // Scraping target
	serveMux.HandleFunc("GET /api/observability/stats", s.handleGetStats)             // JSON details
	serveMux.HandleFunc("GET /api/costs", s.handleGetCosts)

	// Workflow Engine
	serveMux.HandleFunc("POST /api/workflows", s.handleDefineWorkflow)
	serveMux.HandleFunc("POST /api/workflows/{name}/execute", s.handleExecuteWorkflow)
	serveMux.HandleFunc("GET /api/workflows/executions/{id}", s.handleGetWorkflowExecution)

	// Agent Marketplace
	serveMux.HandleFunc("GET /api/marketplace", s.handleListMarketplace)
	serveMux.HandleFunc("POST /api/marketplace/install", s.handleInstallFromMarketplace)

	// Load-balanced HTTP Proxy Router
	serveMux.HandleFunc("/proxy/", s.proxy.ServeHTTP)

	// Serve static files for the dashboard control panel
	serveMux.Handle("GET /dashboard/", http.StripPrefix("/dashboard/", http.FileServer(http.Dir("./dashboard"))))
	
	// Redirect root requests to the dashboard path
	serveMux.HandleFunc("GET /{$}", func(responseWriter http.ResponseWriter, request *http.Request) {
		http.Redirect(responseWriter, request, "/dashboard/", http.StatusFound)
	})
}

// DeployRequest defines the input payload for registering a deployment.
type DeployRequest struct {
	Path string `json:"path"`
}

// ScaleRequest defines the input payload for manually scaling.
type ScaleRequest struct {
	Replicas int `json:"replicas"`
}

// InstanceDTO represents a simplified serializable representation of an active instance.
type InstanceDTO struct {
	ID        string    `json:"id"`
	Port      int       `json:"port"`
	NodeID    string    `json:"node_id"`
	Version   string    `json:"version"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"started_at"`
}

// DeploymentDTO represents a simplified serializable representation of an agent deployment.
type DeploymentDTO struct {
	Name            string        `json:"name"`
	Version         string        `json:"version"`
	Command         string        `json:"command"`
	ResolvedDir     string        `json:"resolved_dir"`
	DesiredReplicas int           `json:"desired_replicas"`
	MinReplicas     int           `json:"min_replicas"`
	MaxReplicas     int           `json:"max_replicas"`
	IdleTimeout     string        `json:"idle_timeout"`
	LastTrafficTime time.Time     `json:"last_traffic_time"`
	Instances       []InstanceDTO `json:"instances"`
}

// handleDeploy parses an agent.yaml path, registers it with the registry and scheduler, and starts replicas.
func (s *APIServer) handleDeploy(responseWriter http.ResponseWriter, request *http.Request) {
	var deployRequestBody DeployRequest
	decoder := json.NewDecoder(request.Body)
	if err := decoder.Decode(&deployRequestBody); err != nil {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Invalid JSON request payload")
		return
	}

	if deployRequestBody.Path == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing 'path' property specifying path to agent.yaml")
		return
	}

	agentManifest, err := ParseManifest(deployRequestBody.Path)
	if err != nil {
		s.respondWithError(responseWriter, http.StatusBadRequest, fmt.Sprintf("Failed to parse agent manifest YAML: %v", err))
		return
	}

	// Register in Agent Registry
	err = s.registry.Register(agentManifest)
	if err != nil {
		s.respondWithError(responseWriter, http.StatusInternalServerError, fmt.Sprintf("Failed to register agent: %v", err))
		return
	}

	// Trigger Scheduler deploy
	err = s.scheduler.Deploy(agentManifest)
	if err != nil {
		s.respondWithError(responseWriter, http.StatusInternalServerError, fmt.Sprintf("Failed to deploy agent: %v", err))
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": fmt.Sprintf("Successfully deployed agent %s (version %s)", agentManifest.Name, agentManifest.Version),
		"agent":   agentManifest.Name,
		"version": agentManifest.Version,
	})
}

// handleDeleteDeploy stops all replicas and deletes an agent's deployment metadata.
func (s *APIServer) handleDeleteDeploy(responseWriter http.ResponseWriter, request *http.Request) {
	agentName := request.PathValue("name")
	if agentName == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing agent name in URI path")
		return
	}

	err := s.scheduler.Undeploy(agentName)
	if err != nil {
		s.respondWithError(responseWriter, http.StatusNotFound, err.Error())
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": fmt.Sprintf("Successfully deleted deployment %s", agentName),
		"agent":   agentName,
	})
}

// handleListAgents returns deployment configurations and active replica details.
func (s *APIServer) handleListAgents(responseWriter http.ResponseWriter, request *http.Request) {
	deployments := s.scheduler.GetDeployments()
	serializedDeployments := make([]DeploymentDTO, 0, len(deployments))

	for _, dep := range deployments {
		dep.lock.RLock()
		instances := make([]InstanceDTO, 0, len(dep.Instances))
		for _, inst := range dep.Instances {
			inst.lock.Lock()
			instances = append(instances, InstanceDTO{
				ID:        inst.ID,
				Port:      inst.Port,
				NodeID:    inst.NodeID,
				Version:   inst.Version,
				Status:    string(inst.Status),
				StartedAt: inst.StartedAt,
			})
			inst.lock.Unlock()
		}

		serializedDeployments = append(serializedDeployments, DeploymentDTO{
			Name:            dep.Manifest.Name,
			Version:         dep.Manifest.Version,
			Command:         dep.Manifest.Command,
			ResolvedDir:     dep.Manifest.ResolvedDir,
			DesiredReplicas: dep.DesiredReplicas,
			MinReplicas:     dep.Manifest.MinReplicas,
			MaxReplicas:     dep.Manifest.MaxReplicas,
			IdleTimeout:     dep.Manifest.IdleTimeout,
			LastTrafficTime: dep.LastTrafficTime,
			Instances:       instances,
		})
		dep.lock.RUnlock()
	}

	s.respondWithJSON(responseWriter, http.StatusOK, serializedDeployments)
}

// handleGetLogs aggregates and returns stdout/stderr logs from all replicas.
func (s *APIServer) handleGetLogs(responseWriter http.ResponseWriter, request *http.Request) {
	agentName := request.PathValue("name")
	if agentName == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing agent name in URI path")
		return
	}

	deployment, exists := s.scheduler.GetDeployment(agentName)
	if !exists {
		s.respondWithError(responseWriter, http.StatusNotFound, fmt.Sprintf("Agent %s not found", agentName))
		return
	}

	deployment.lock.RLock()
	defer deployment.lock.RUnlock()

	type InstanceLog struct {
		InstanceID string    `json:"instance_id"`
		Port       int       `json:"port"`
		NodeID     string    `json:"node_id"`
		Status     string    `json:"status"`
		Logs       string    `json:"logs"`
		UpdatedAt  time.Time `json:"updated_at"`
	}

	activeInstanceLogs := make([]InstanceLog, 0, len(deployment.Instances))
	for _, inst := range deployment.Instances {
		inst.lock.Lock()
		activeInstanceLogs = append(activeInstanceLogs, InstanceLog{
			InstanceID: inst.ID,
			Port:       inst.Port,
			NodeID:     inst.NodeID,
			Status:     string(inst.Status),
			Logs:       inst.GetLogs(),
			UpdatedAt:  inst.UpdatedAt,
		})
		inst.lock.Unlock()
	}

	pastInstanceLogs := make([]InstanceLog, 0, len(deployment.PastInstances))
	for _, inst := range deployment.PastInstances {
		inst.lock.Lock()
		pastInstanceLogs = append(pastInstanceLogs, InstanceLog{
			InstanceID: inst.ID,
			Port:       inst.Port,
			NodeID:     inst.NodeID,
			Status:     string(inst.Status),
			Logs:       inst.GetLogs(),
			UpdatedAt:  inst.UpdatedAt,
		})
		inst.lock.Unlock()
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]interface{}{
		"agent":             agentName,
		"active_instances":  activeInstanceLogs,
		"history_instances": pastInstanceLogs,
	})
}

// handleScale updates the desired replica count and invokes reconciliation.
func (s *APIServer) handleScale(responseWriter http.ResponseWriter, request *http.Request) {
	agentName := request.PathValue("name")
	if agentName == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing agent name in URI path")
		return
	}

	var scaleRequestBody ScaleRequest
	decoder := json.NewDecoder(request.Body)
	if err := decoder.Decode(&scaleRequestBody); err != nil {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Invalid JSON request payload")
		return
	}

	if scaleRequestBody.Replicas < 0 {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Replica count cannot be negative")
		return
	}

	deployment, exists := s.scheduler.GetDeployment(agentName)
	if !exists {
		s.respondWithError(responseWriter, http.StatusNotFound, fmt.Sprintf("Agent %s not found", agentName))
		return
	}

	deployment.lock.Lock()
	deployment.DesiredReplicas = scaleRequestBody.Replicas
	deployment.lock.Unlock()

	s.scheduler.Reconcile(agentName)

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": fmt.Sprintf("Successfully scaled desired replicas for agent %s to %d", agentName, scaleRequestBody.Replicas),
		"agent":   agentName,
	})
}

// handleCreateJob enqueues an asynchronous agent request.
func (s *APIServer) handleCreateJob(responseWriter http.ResponseWriter, request *http.Request) {
	agentName := request.PathValue("name")
	if agentName == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing agent name in URI path")
		return
	}

	var inputPayload map[string]interface{}
	decoder := json.NewDecoder(request.Body)
	if err := decoder.Decode(&inputPayload); err != nil {
		inputPayload = make(map[string]interface{})
	}

	_, exists := s.scheduler.GetDeployment(agentName)
	if !exists {
		s.respondWithError(responseWriter, http.StatusNotFound, fmt.Sprintf("Agent %s not found", agentName))
		return
	}

	jobID := s.jobQueue.Submit(agentName, inputPayload)

	s.respondWithJSON(responseWriter, http.StatusAccepted, map[string]interface{}{
		"status":  "success",
		"message": "Job successfully enqueued",
		"job_id":  jobID,
	})
}

// handleGetJob returns the status and outputs of an enqueued task.
func (s *APIServer) handleGetJob(responseWriter http.ResponseWriter, request *http.Request) {
	jobID := request.PathValue("id")
	if jobID == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing job ID in URI path")
		return
	}

	job, exists := s.jobQueue.GetJob(jobID)
	if !exists {
		s.respondWithError(responseWriter, http.StatusNotFound, fmt.Sprintf("Job %s not found", jobID))
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, job)
}

// --- NEW SUBSYSTEM HANDLER METHODS ---

// handleGetRegistry returns all registered agent manifests.
func (s *APIServer) handleGetRegistry(responseWriter http.ResponseWriter, request *http.Request) {
	s.respondWithJSON(responseWriter, http.StatusOK, s.registry.List())
}

// handleRegisterManifest registers an agent manifest directly.
func (s *APIServer) handleRegisterManifest(responseWriter http.ResponseWriter, request *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(request.Body).Decode(&body); err != nil || body.Path == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing or invalid 'path' configuration parameter")
		return
	}

	manifest, err := ParseManifest(body.Path)
	if err != nil {
		s.respondWithError(responseWriter, http.StatusBadRequest, fmt.Sprintf("Failed to parse manifest: %v", err))
		return
	}

	if err := s.registry.Register(manifest); err != nil {
		s.respondWithError(responseWriter, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": fmt.Sprintf("Successfully registered agent %s:%s in registry", manifest.Name, manifest.Version),
	})
}

// handleGetNodes returns all cluster nodes and resource stats.
func (s *APIServer) handleGetNodes(responseWriter http.ResponseWriter, request *http.Request) {
	s.respondWithJSON(responseWriter, http.StatusOK, s.nodeManager.GetNodes())
}

// handleSetSecret creates or updates a secret key-value.
func (s *APIServer) handleSetSecret(responseWriter http.ResponseWriter, request *http.Request) {
	var req struct {
		Namespace string `json:"namespace"`
		Key       string `json:"key"`
		Value     string `json:"value"`
	}
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil || req.Namespace == "" || req.Key == "" || req.Value == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Invalid payload. Required properties: namespace, key, value")
		return
	}

	s.secretsManager.SetSecret(req.Namespace, req.Key, req.Value)
	s.respondWithJSON(responseWriter, http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Secret '%s' set in namespace '%s'", req.Key, req.Namespace),
	})
}

// handleGetSecrets lists secrets under a namespace, masking values for safety.
func (s *APIServer) handleGetSecrets(responseWriter http.ResponseWriter, request *http.Request) {
	namespace := request.PathValue("namespace")
	if namespace == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing namespace parameter")
		return
	}

	rawSecrets := s.secretsManager.GetSecrets(namespace)
	masked := make(map[string]string)
	for k := range rawSecrets {
		masked[k] = "********" // Mask values for API response security
	}

	s.respondWithJSON(responseWriter, http.StatusOK, masked)
}

// handleDeleteSecret removes a secret.
func (s *APIServer) handleDeleteSecret(responseWriter http.ResponseWriter, request *http.Request) {
	namespace := request.PathValue("namespace")
	key := request.PathValue("key")
	if namespace == "" || key == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing namespace or key parameter")
		return
	}

	if err := s.secretsManager.DeleteSecret(namespace, key); err != nil {
		s.respondWithError(responseWriter, http.StatusNotFound, err.Error())
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Secret '%s' deleted from namespace '%s'", key, namespace),
	})
}

// handlePublishEvent publishes an event message to a topic.
func (s *APIServer) handlePublishEvent(responseWriter http.ResponseWriter, request *http.Request) {
	var req struct {
		Topic     string                 `json:"topic"`
		Publisher string                 `json:"publisher"`
		Payload   map[string]interface{} `json:"payload"`
	}
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil || req.Topic == "" || req.Publisher == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Invalid payload. Required parameters: topic, publisher")
		return
	}

	eventID := s.eventBus.Publish(req.Topic, req.Publisher, req.Payload)
	s.respondWithJSON(responseWriter, http.StatusOK, map[string]string{
		"status":   "success",
		"event_id": eventID,
		"message":  "Event published successfully",
	})
}

// handleSubscribeTopic registers a subscriber to a topic.
func (s *APIServer) handleSubscribeTopic(responseWriter http.ResponseWriter, request *http.Request) {
	var req struct {
		Topic     string `json:"topic"`
		AgentName string `json:"agent_name"`
		Endpoint  string `json:"endpoint"`
	}
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil || req.Topic == "" || req.AgentName == "" || req.Endpoint == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Invalid payload. Required parameters: topic, agent_name, endpoint")
		return
	}

	s.eventBus.Subscribe(req.Topic, req.AgentName, req.Endpoint)
	s.respondWithJSON(responseWriter, http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Subscribed agent '%s' to topic '%s'", req.AgentName, req.Topic),
	})
}

// handleGetEventHistory lists event logs.
func (s *APIServer) handleGetEventHistory(responseWriter http.ResponseWriter, request *http.Request) {
	s.respondWithJSON(responseWriter, http.StatusOK, s.eventBus.GetHistory())
}

// handleGetState retrieves state variables.
func (s *APIServer) handleGetState(responseWriter http.ResponseWriter, request *http.Request) {
	agent := request.PathValue("agent")
	key := request.PathValue("key")
	if agent == "" || key == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing agent or key parameter")
		return
	}

	val, found := s.stateStore.Get(agent, key)
	if !found {
		s.respondWithError(responseWriter, http.StatusNotFound, "State entry not found")
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]string{
		"agent": agent,
		"key":   key,
		"value": val,
	})
}

// handlePutState stores state variables.
func (s *APIServer) handlePutState(responseWriter http.ResponseWriter, request *http.Request) {
	agent := request.PathValue("agent")
	key := request.PathValue("key")
	if agent == "" || key == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing agent or key parameter")
		return
	}

	bodyBytes, err := io.ReadAll(request.Body)
	if err != nil {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Failed to read request body")
		return
	}

	s.stateStore.Put(agent, key, string(bodyBytes))
	s.respondWithJSON(responseWriter, http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("State updated for '%s' (key: '%s')", agent, key),
	})
}

// handleGetPrometheusMetrics writes Prometheus formatted metrics.
func (s *APIServer) handleGetPrometheusMetrics(responseWriter http.ResponseWriter, request *http.Request) {
	responseWriter.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	responseWriter.WriteHeader(http.StatusOK)
	_, _ = responseWriter.Write([]byte(s.observability.GetPrometheusMetrics()))
}

// handleGetStats returns observability json dashboard stats.
func (s *APIServer) handleGetStats(responseWriter http.ResponseWriter, request *http.Request) {
	agentName := request.URL.Query().Get("agent")
	s.respondWithJSON(responseWriter, http.StatusOK, s.observability.GetMetrics(agentName))
}

// handleGetCosts returns billing costs summary.
func (s *APIServer) handleGetCosts(responseWriter http.ResponseWriter, request *http.Request) {
	s.respondWithJSON(responseWriter, http.StatusOK, s.observability.GetCostsSummary())
}

// handleDefineWorkflow defines a pipeline process.
func (s *APIServer) handleDefineWorkflow(responseWriter http.ResponseWriter, request *http.Request) {
	var def WorkflowDefinition
	if err := json.NewDecoder(request.Body).Decode(&def); err != nil {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Invalid JSON workflow payload")
		return
	}

	if err := s.workflowEngine.Define(&def); err != nil {
		s.respondWithError(responseWriter, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]string{
		"status":  "success",
		"message": fmt.Sprintf("Workflow '%s' successfully defined", def.Name),
	})
}

// handleExecuteWorkflow runs a workflow DAG process.
func (s *APIServer) handleExecuteWorkflow(responseWriter http.ResponseWriter, request *http.Request) {
	workflowName := request.PathValue("name")
	if workflowName == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing workflow name parameter")
		return
	}

	var input map[string]interface{}
	if err := json.NewDecoder(request.Body).Decode(&input); err != nil {
		input = make(map[string]interface{})
	}

	execID, err := s.workflowEngine.Execute(workflowName, input)
	if err != nil {
		s.respondWithError(responseWriter, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondWithJSON(responseWriter, http.StatusAccepted, map[string]string{
		"status":       "success",
		"execution_id": execID,
		"message":      "Workflow execution successfully enqueued",
	})
}

// handleGetWorkflowExecution fetches running/completed workflow logs.
func (s *APIServer) handleGetWorkflowExecution(responseWriter http.ResponseWriter, request *http.Request) {
	execID := request.PathValue("id")
	if execID == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Missing execution ID parameter")
		return
	}

	execution, found := s.workflowEngine.GetExecution(execID)
	if !found {
		s.respondWithError(responseWriter, http.StatusNotFound, "Workflow execution not found")
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, execution)
}

// handleListMarketplace lists available agent templates.
func (s *APIServer) handleListMarketplace(responseWriter http.ResponseWriter, request *http.Request) {
	s.respondWithJSON(responseWriter, http.StatusOK, s.marketplace.List())
}

// handleInstallFromMarketplace installs and registers an agent template.
func (s *APIServer) handleInstallFromMarketplace(responseWriter http.ResponseWriter, request *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(request.Body).Decode(&req); err != nil || req.Name == "" {
		s.respondWithError(responseWriter, http.StatusBadRequest, "Invalid payload. Required: name")
		return
	}

	tmpl, exists := s.marketplace.Get(req.Name)
	if !exists {
		s.respondWithError(responseWriter, http.StatusNotFound, fmt.Sprintf("Template '%s' not found in marketplace", req.Name))
		return
	}

	// In a real setup, we would write this config to a file or database.
	// For simulation, we parse the default yaml string directly and register it!
	var parsedManifest AgentManifest
	// Parse default yaml (we can import gopkg.in/yaml.v3)
	var yaml = requireYamlParser()
	if err := yaml.Unmarshal([]byte(tmpl.DefaultYaml), &parsedManifest); err != nil {
		s.respondWithError(responseWriter, http.StatusInternalServerError, fmt.Sprintf("Failed parsing template yaml: %v", err))
		return
	}

	// Resolve fake dir to current agent infra folder so it has a valid target command execution dir
	parsedManifest.ResolvedDir = "."

	if err := s.registry.Register(&parsedManifest); err != nil {
		s.respondWithError(responseWriter, http.StatusInternalServerError, err.Error())
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]interface{}{
		"status":      "success",
		"message":     fmt.Sprintf("Installed agent template '%s' successfully from Marketplace", req.Name),
		"manifest":    parsedManifest,
	})
}

// Helper to keep Yaml loading clean and isolated
func requireYamlParser() interface {
	Unmarshal(in []byte, out interface{}) error
} {
	return yamlUnmarshalWrapper{}
}

type yamlUnmarshalWrapper struct{}

func (y yamlUnmarshalWrapper) Unmarshal(in []byte, out interface{}) error {
	return yaml.Unmarshal(in, out)
}

// respondWithError responds with a standard error format.
func (s *APIServer) respondWithError(responseWriter http.ResponseWriter, statusCode int, errorMessage string) {
	s.respondWithJSON(responseWriter, statusCode, map[string]string{"error": errorMessage})
}

// respondWithJSON responds with serialized JSON payload.
func (s *APIServer) respondWithJSON(responseWriter http.ResponseWriter, statusCode int, payload interface{}) {
	responseBytes, err := json.Marshal(payload)
	if err != nil {
		responseWriter.WriteHeader(http.StatusInternalServerError)
		_, _ = responseWriter.Write([]byte(`{"error": "internal JSON encoding error"}`))
		return
	}

	responseWriter.Header().Set("Content-Type", "application/json")
	responseWriter.WriteHeader(statusCode)
	_, _ = responseWriter.Write(responseBytes)
}

