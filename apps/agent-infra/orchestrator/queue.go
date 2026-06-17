package orchestrator

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// JobStatus represents the state of an asynchronous agent job execution.
type JobStatus string

const (
	JobPending   JobStatus = "PENDING"
	JobRunning   JobStatus = "RUNNING"
	JobCompleted JobStatus = "COMPLETED"
	JobFailed    JobStatus = "FAILED"
)

// Job represents a single async task execution request and its execution statistics.
type Job struct {
	ID         string                 `json:"id"`
	AgentName  string                 `json:"agent_name"`
	Input      map[string]interface{} `json:"input"`
	Output     interface{}            `json:"output,omitempty"`
	Status     JobStatus              `json:"status"`
	Error      string                 `json:"error,omitempty"`
	CreatedAt  time.Time              `json:"created_at"`
	FinishedAt time.Time              `json:"finished_at,omitempty"`
}

// JobQueue manages the submitting, queueing, and processing of asynchronous tasks.
type JobQueue struct {
	scheduler   *Scheduler
	jobs        map[string]*Job
	jobsLock    sync.RWMutex
	queueChannel chan string // Channel storing Job IDs to be picked up by workers
	workerCount int
}

// NewJobQueue initializes a thread-safe task queue with the specified buffer and worker size.
func NewJobQueue(scheduler *Scheduler, bufferSize int, workerCount int) *JobQueue {
	return &JobQueue{
		scheduler:   scheduler,
		jobs:        make(map[string]*Job),
		queueChannel: make(chan string, bufferSize),
		workerCount: workerCount,
	}
}

// Submit enqueues a new agent job and returns a unique Job ID.
func (jq *JobQueue) Submit(agentName string, input map[string]interface{}) string {
	jobID := uuid.New().String()
	newJob := &Job{
		ID:        jobID,
		AgentName: agentName,
		Input:     input,
		Status:    JobPending,
		CreatedAt: time.Now(),
	}

	jq.jobsLock.Lock()
	jq.jobs[jobID] = newJob
	jq.jobsLock.Unlock()

	jq.queueChannel <- jobID
	fmt.Printf("[Queue] Enqueued Job %s for agent %s\n", jobID, agentName)
	return jobID
}

// GetJob retrieves a deep copy of a job's status and outputs.
func (jq *JobQueue) GetJob(jobID string) (*Job, bool) {
	jq.jobsLock.RLock()
	defer jq.jobsLock.RUnlock()

	job, exists := jq.jobs[jobID]
	if !exists {
		return nil, false
	}

	// Copy struct to prevent race conditions during read operations
	copiedJob := *job
	return &copiedJob, true
}

// Start launches background processing worker goroutines.
func (jq *JobQueue) Start(ctx context.Context) {
	for i := 0; i < jq.workerCount; i++ {
		go jq.workerLoop(ctx, i)
	}
}

// workerLoop represents a single worker polling the job queue channel.
func (jq *JobQueue) workerLoop(ctx context.Context, workerID int) {
	fmt.Printf("[Queue Worker %d] Initialized and listening for tasks...\n", workerID)
	for {
		select {
		case <-ctx.Done():
			fmt.Printf("[Queue Worker %d] Shutting down worker\n", workerID)
			return
		case jobID := <-jq.queueChannel:
			jq.processJob(jobID, workerID)
		}
	}
}

// processJob retrieves a job, activates the agent runtime, invokes the agent, and persists the result.
func (jq *JobQueue) processJob(jobID string, workerID int) {
	jq.jobsLock.RLock()
	job, exists := jq.jobs[jobID]
	jq.jobsLock.RUnlock()

	if !exists {
		return
	}

	jq.updateJobStatus(jobID, JobRunning, nil, "")
	fmt.Printf("[Queue Worker %d] Processing Job %s for agent %s...\n", workerID, jobID, job.AgentName)

	// 1. Ensure the target agent is deployed, running, and healthy (autoscaling up if scaled to zero).
	err := jq.scheduler.EnsureActive(job.AgentName)
	if err != nil {
		jq.updateJobStatus(jobID, JobFailed, nil, fmt.Sprintf("failed to scale/activate agent: %v", err))
		return
	}

	// 2. Fetch the list of running instances.
	deployment, ok := jq.scheduler.GetDeployment(job.AgentName)
	if !ok {
		jq.updateJobStatus(jobID, JobFailed, nil, "agent deployment was deleted")
		return
	}

	deployment.lock.Lock()
	deployment.LastTrafficTime = time.Now() // Register activity
	deployment.lock.Unlock()

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
		jq.updateJobStatus(jobID, JobFailed, nil, "no healthy agent instances available to process job")
		return
	}

	// Select the first healthy instance.
	selectedInstance := healthyInstances[0]

	// 3. Make HTTP request to agent endpoint /invoke.
	// Convert input JSON properties into HTTP POST payload or fallback to GET query parameters.
	requestURL := fmt.Sprintf("http://localhost:%d/invoke", selectedInstance.Port)
	httpClient := &http.Client{Timeout: 60 * time.Second}

	jsonBody, err := json.Marshal(job.Input)
	if err != nil {
		jq.updateJobStatus(jobID, JobFailed, nil, fmt.Sprintf("failed to marshal input JSON: %v", err))
		return
	}

	fmt.Printf("[Queue Worker %d] Dispatching HTTP POST request to %s\n", workerID, requestURL)
	postRequest, err := http.NewRequest("POST", requestURL, bytes.NewBuffer(jsonBody))
	var httpResponse *http.Response
	
	if err == nil {
		postRequest.Header.Set("Content-Type", "application/json")
		httpResponse, err = httpClient.Do(postRequest)
	}

	useFallback := false
	if err != nil {
		useFallback = true
	} else if httpResponse.StatusCode == http.StatusMethodNotAllowed || httpResponse.StatusCode == http.StatusNotFound {
		httpResponse.Body.Close()
		useFallback = true
	}

	if useFallback {
		fmt.Printf("[Queue Worker %d] POST failed or not allowed. Falling back to HTTP GET to %s\n", workerID, requestURL)
		
		getRequest, err := http.NewRequest("GET", requestURL, nil)
		if err != nil {
			jq.updateJobStatus(jobID, JobFailed, nil, fmt.Sprintf("failed to construct GET request: %v", err))
			return
		}

		queryParameters := getRequest.URL.Query()
		for key, value := range job.Input {
			queryParameters.Add(key, fmt.Sprintf("%v", value))
		}
		getRequest.URL.RawQuery = queryParameters.Encode()

		httpResponse, err = httpClient.Do(getRequest)
		if err != nil {
			jq.updateJobStatus(jobID, JobFailed, nil, fmt.Sprintf("HTTP GET request to agent failed: %v", err))
			return
		}
	}
	defer httpResponse.Body.Close()

	responseBytes, err := io.ReadAll(httpResponse.Body)
	if err != nil {
		jq.updateJobStatus(jobID, JobFailed, nil, fmt.Sprintf("failed to read response payload: %v", err))
		return
	}

	if httpResponse.StatusCode != http.StatusOK {
		jq.updateJobStatus(jobID, JobFailed, nil, fmt.Sprintf("agent responded with non-200 status %d: %s", httpResponse.StatusCode, string(responseBytes)))
		return
	}

	// 4. Save results and complete the job.
	var parsedJSONResponse interface{}
	if err := json.Unmarshal(responseBytes, &parsedJSONResponse); err == nil {
		jq.updateJobStatus(jobID, JobCompleted, parsedJSONResponse, "")
	} else {
		jq.updateJobStatus(jobID, JobCompleted, string(responseBytes), "")
	}

	fmt.Printf("[Queue Worker %d] Successfully completed Job %s\n", workerID, jobID)
}

// updateJobStatus sets status, outputs, errors, and end times for a job.
func (jq *JobQueue) updateJobStatus(jobID string, status JobStatus, output interface{}, errorMessage string) {
	jq.jobsLock.Lock()
	defer jq.jobsLock.Unlock()

	job, exists := jq.jobs[jobID]
	if !exists {
		return
	}

	job.Status = status
	job.Output = output
	job.Error = errorMessage
	if status == JobCompleted || status == JobFailed {
		job.FinishedAt = time.Now()
	}
}

// GetPendingJobsCount counts the number of pending or running jobs for a specific agent.
func (jq *JobQueue) GetPendingJobsCount(agentName string) int {
	jq.jobsLock.RLock()
	defer jq.jobsLock.RUnlock()

	pendingJobsCount := 0
	for _, job := range jq.jobs {
		if job.AgentName == agentName && (job.Status == JobPending || job.Status == JobRunning) {
			pendingJobsCount++
		}
	}
	return pendingJobsCount
}
