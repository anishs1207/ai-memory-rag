package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// APIServer manages the REST API endpoints and routes requests to corresponding managers.
type APIServer struct {
	scheduler *Scheduler
	jobQueue  *JobQueue
	proxy     *ProxyHandler
}

// NewAPIServer creates a new API server instance.
func NewAPIServer(scheduler *Scheduler, jobQueue *JobQueue, proxy *ProxyHandler) *APIServer {
	return &APIServer{
		scheduler: scheduler,
		jobQueue:  jobQueue,
		proxy:     proxy,
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

	// Load-balanced HTTP Proxy Router
	serveMux.HandleFunc("/proxy/", s.proxy.ServeHTTP)
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
	Status    string    `json:"status"`
	StartedAt time.Time `json:"started_at"`
}

// DeploymentDTO represents a simplified serializable representation of an agent deployment.
type DeploymentDTO struct {
	Name            string        `json:"name"`
	Command         string        `json:"command"`
	ResolvedDir     string        `json:"resolved_dir"`
	DesiredReplicas int           `json:"desired_replicas"`
	MinReplicas     int           `json:"min_replicas"`
	MaxReplicas     int           `json:"max_replicas"`
	IdleTimeout     string        `json:"idle_timeout"`
	LastTrafficTime time.Time     `json:"last_traffic_time"`
	Instances       []InstanceDTO `json:"instances"`
}

// handleDeploy parses an agent.yaml path, parses the configuration, and registers it with the scheduler.
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

	err = s.scheduler.Deploy(agentManifest)
	if err != nil {
		s.respondWithError(responseWriter, http.StatusInternalServerError, fmt.Sprintf("Failed to deploy agent: %v", err))
		return
	}

	s.respondWithJSON(responseWriter, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": fmt.Sprintf("Successfully deployed agent %s", agentManifest.Name),
		"agent":   agentManifest.Name,
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
				Status:    string(inst.Status),
				StartedAt: inst.StartedAt,
			})
			inst.lock.Unlock()
		}

		serializedDeployments = append(serializedDeployments, DeploymentDTO{
			Name:            dep.Manifest.Name,
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

// handleGetLogs aggregates and returns stdout/stderr logs from all replicas (both active and terminated history).
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
		Status     string    `json:"status"`
		Logs       string    `json:"logs"`
		UpdatedAt  time.Time `json:"updated_at"`
	}

	// Retrieve active instance logs
	activeInstanceLogs := make([]InstanceLog, 0, len(deployment.Instances))
	for _, inst := range deployment.Instances {
		inst.lock.Lock()
		activeInstanceLogs = append(activeInstanceLogs, InstanceLog{
			InstanceID: inst.ID,
			Port:       inst.Port,
			Status:     string(inst.Status),
			Logs:       inst.GetLogs(),
			UpdatedAt:  inst.UpdatedAt,
		})
		inst.lock.Unlock()
	}

	// Retrieve past (terminated) instance logs
	pastInstanceLogs := make([]InstanceLog, 0, len(deployment.PastInstances))
	for _, inst := range deployment.PastInstances {
		inst.lock.Lock()
		pastInstanceLogs = append(pastInstanceLogs, InstanceLog{
			InstanceID: inst.ID,
			Port:       inst.Port,
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

	// Reconcile changes immediately
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
		// Default to empty payload if missing or empty
		inputPayload = make(map[string]interface{})
	}

	// Verify the agent exists before enqueueing a job
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
