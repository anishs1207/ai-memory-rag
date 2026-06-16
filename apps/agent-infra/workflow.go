package main

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// WorkflowStep defines a single execution step in a multi-agent workflow pipeline.
type WorkflowStep struct {
	Name          string                 `json:"name"`
	AgentName     string                 `json:"agent_name"`
	InputTemplate map[string]interface{} `json:"input_template"` // Key-value map using placeholders like {{input.key}} or {{steps.stepname.output}}
}

// WorkflowDefinition specifies the blueprint schema of an agent workflow pipeline.
type WorkflowDefinition struct {
	Name  string         `json:"name"`
	Steps []WorkflowStep `json:"steps"`
}

// WorkflowExecution tracks the runtime status and data context of an executing workflow instance.
type WorkflowExecution struct {
	ID           string                 `json:"id"`
	WorkflowName string                 `json:"workflow_name"`
	Status       string                 `json:"status"` // PENDING, RUNNING, COMPLETED, FAILED
	Input        map[string]interface{} `json:"input"`
	StepResults  map[string]interface{} `json:"step_results"`
	Output       interface{}            `json:"output,omitempty"`
	Error        string                 `json:"error,omitempty"`
	StartedAt    time.Time              `json:"started_at"`
	FinishedAt   time.Time              `json:"finished_at,omitempty"`
}

// WorkflowEngine registers definitions and tracks workflow instance state execution histories.
type WorkflowEngine struct {
	definitions   map[string]*WorkflowDefinition
	executions    map[string]*WorkflowExecution
	engineLock    sync.RWMutex
	jobQueue      *JobQueue
}

// NewWorkflowEngine initializes a thread-safe WorkflowEngine tied to the shared job queue.
func NewWorkflowEngine(jobQueue *JobQueue) *WorkflowEngine {
	engine := &WorkflowEngine{
		definitions: make(map[string]*WorkflowDefinition),
		executions:  make(map[string]*WorkflowExecution),
		jobQueue:    jobQueue,
	}
	engine.seedDefaultWorkflows()
	return engine
}

func (we *WorkflowEngine) seedDefaultWorkflows() {
	// Seed a pipeline: calculator-agent (performs a sum) -> weather-agent (uses sum to lookup something)
	we.definitions["agent-pipeline"] = &WorkflowDefinition{
		Name: "agent-pipeline",
		Steps: []WorkflowStep{
			{
				Name:      "calculate-offset",
				AgentName: "calculator-agent",
				InputTemplate: map[string]interface{}{
					"op": "add",
					"a":  "{{input.val1}}",
					"b":  "{{input.val2}}",
				},
			},
			{
				Name:      "fetch-weather",
				AgentName: "weather-agent",
				InputTemplate: map[string]interface{}{
					"city":   "{{input.city}}",
					"offset": "{{steps.calculate-offset.output.result}}",
				},
			},
		},
	}
}

// Define registers or updates a workflow structure.
func (we *WorkflowEngine) Define(def *WorkflowDefinition) error {
	if def.Name == "" {
		return fmt.Errorf("workflow name cannot be empty")
	}
	if len(def.Steps) == 0 {
		return fmt.Errorf("workflow must contain at least one step")
	}

	we.engineLock.Lock()
	defer we.engineLock.Unlock()

	we.definitions[def.Name] = def
	fmt.Printf("[Workflow Engine] Defined workflow: %s (%d steps)\n", def.Name, len(def.Steps))
	return nil
}

// Execute triggers a background runner thread to execute the workflow steps sequentially.
func (we *WorkflowEngine) Execute(workflowName string, input map[string]interface{}) (string, error) {
	we.engineLock.RLock()
	def, exists := we.definitions[workflowName]
	we.engineLock.RUnlock()

	if !exists {
		return "", fmt.Errorf("workflow '%s' not found", workflowName)
	}

	executionID := uuid.New().String()
	execution := &WorkflowExecution{
		ID:           executionID,
		WorkflowName: workflowName,
		Status:       "PENDING",
		Input:        input,
		StepResults:  make(map[string]interface{}),
		StartedAt:    time.Now(),
	}

	we.engineLock.Lock()
	we.executions[executionID] = execution
	we.engineLock.Unlock()

	fmt.Printf("[Workflow Engine] Spawned workflow execution %s for pipeline %s\n", executionID, workflowName)
	go we.runWorkflowLifecycle(def, execution)

	return executionID, nil
}

// GetExecution retrieves the execution status and output logs.
func (we *WorkflowEngine) GetExecution(executionID string) (*WorkflowExecution, bool) {
	we.engineLock.RLock()
	defer we.engineLock.RUnlock()

	execution, exists := we.executions[executionID]
	if !exists {
		return nil, false
	}

	// Copy struct fields to avoid race conditions during endpoint queries
	copied := *execution
	return &copied, true
}

func (we *WorkflowEngine) runWorkflowLifecycle(def *WorkflowDefinition, exec *WorkflowExecution) {
	we.updateExecutionStatus(exec.ID, "RUNNING", nil, "")

	for _, step := range def.Steps {
		fmt.Printf("[Workflow Runner %s] Starting step '%s' using agent '%s'\n", exec.ID[:8], step.Name, step.AgentName)

		// 1. Resolve inputs using trigger input and previous results
		resolvedInputs := we.resolveInputTemplate(step.InputTemplate, exec.Input, exec.StepResults)

		// 2. Submit job to the Async Queue
		jobID := we.jobQueue.Submit(step.AgentName, resolvedInputs)

		// 3. Poll queue until job is resolved or fails
		var completedJob *Job
		var jobErr error
		timeoutDeadline := time.Now().Add(5 * time.Minute)

		for time.Now().Before(timeoutDeadline) {
			job, found := we.jobQueue.GetJob(jobID)
			if !found {
				jobErr = fmt.Errorf("job %s lost from queue", jobID)
				break
			}

			if job.Status == JobCompleted {
				completedJob = job
				break
			}
			if job.Status == JobFailed {
				jobErr = fmt.Errorf("agent execution failed: %s", job.Error)
				break
			}

			time.Sleep(500 * time.Millisecond)
		}

		if completedJob == nil && jobErr == nil {
			jobErr = fmt.Errorf("step execution timed out after 5 minutes")
		}

		if jobErr != nil {
			errMessage := fmt.Sprintf("Step '%s' failed: %v", step.Name, jobErr)
			fmt.Printf("[Workflow Runner %s] Error: %s\n", exec.ID[:8], errMessage)
			we.updateExecutionStatus(exec.ID, "FAILED", nil, errMessage)
			return
		}

		// Save step results
		we.updateStepResult(exec.ID, step.Name, completedJob.Output)
	}

	// Complete workflow, mapping output of the final step as workflow output
	var finalOutput interface{}
	if len(def.Steps) > 0 {
		lastStepName := def.Steps[len(def.Steps)-1].Name
		we.engineLock.RLock()
		if res, exists := exec.StepResults[lastStepName]; exists {
			finalOutput = res
		}
		we.engineLock.RUnlock()
	}

	we.updateExecutionStatus(exec.ID, "COMPLETED", finalOutput, "")
	fmt.Printf("[Workflow Runner %s] Workflow completed successfully.\n", exec.ID[:8])
}

// resolveInputTemplate iterates keys recursively and formats templates
func (we *WorkflowEngine) resolveInputTemplate(template map[string]interface{}, input map[string]interface{}, stepResults map[string]interface{}) map[string]interface{} {
	resolved := make(map[string]interface{})
	for key, value := range template {
		if strVal, ok := value.(string); ok {
			resolved[key] = we.resolveStringPlaceholder(strVal, input, stepResults)
		} else if mapVal, ok := value.(map[string]interface{}); ok {
			resolved[key] = we.resolveInputTemplate(mapVal, input, stepResults)
		} else {
			resolved[key] = value
		}
	}
	return resolved
}

func (we *WorkflowEngine) resolveStringPlaceholder(templateString string, input map[string]interface{}, stepResults map[string]interface{}) interface{} {
	if !strings.HasPrefix(templateString, "{{") || !strings.HasSuffix(templateString, "}}") {
		return templateString
	}

	path := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(templateString, "{{"), "}}"))
	parts := strings.Split(path, ".")

	if len(parts) == 0 {
		return templateString
	}

	// Case 1: {{input.key}}
	if parts[0] == "input" && len(parts) > 1 {
		val, found := input[parts[1]]
		if found {
			return val
		}
		return templateString
	}

	// Case 2: {{steps.stepname.output}} or {{steps.stepname.output.field}}
	if parts[0] == "steps" && len(parts) > 2 {
		stepName := parts[1]
		stepResult, found := stepResults[stepName]
		if !found {
			return templateString
		}

		if parts[2] == "output" {
			if len(parts) == 3 {
				return stepResult
			}
			// Access nested field in map output
			if resultMap, ok := stepResult.(map[string]interface{}); ok {
				nestedVal, ok := resultMap[parts[3]]
				if ok {
					return nestedVal
				}
			}
		}
	}

	return templateString
}

func (we *WorkflowEngine) updateExecutionStatus(executionID string, status string, output interface{}, errorMessage string) {
	we.engineLock.Lock()
	defer we.engineLock.Unlock()

	exec, exists := we.executions[executionID]
	if !exists {
		return
	}

	exec.Status = status
	exec.Output = output
	exec.Error = errorMessage
	if status == "COMPLETED" || status == "FAILED" {
		exec.FinishedAt = time.Now()
	}
}

func (we *WorkflowEngine) updateStepResult(executionID string, stepName string, result interface{}) {
	we.engineLock.Lock()
	defer we.engineLock.Unlock()

	exec, exists := we.executions[executionID]
	if !exists {
		return
	}

	exec.StepResults[stepName] = result
}
