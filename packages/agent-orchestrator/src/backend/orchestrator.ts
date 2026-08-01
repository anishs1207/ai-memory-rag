import type { Workflow, WorkflowState, StepState, StepStatus, StepResult } from "../types/workflow.js"
import { getWorkflow, setWorkflow } from "./workflow-store.js"
import { getReadySteps } from "./dag.js"
import { stepQueue } from "../queue/step-queue.js"
import { resultQueue } from "../queue/result-queue.js"
import { podManager } from "../pod-manager/pod-manager.js"

/**
 * Orchestrator ties together DAG dependency resolution, Redis queues, and PodManager.
 */
export class Orchestrator {
  private isStarted = false

  /**
   * Submit a workflow for execution.
   * Stores initial state with all steps as PENDING, computes initial ready steps,
   * updates ready step states to QUEUED, and pushes them to stepQueue.
   */
  async submitWorkflow(workflow: Workflow): Promise<void> {
    const stepState: Record<string, StepState> = {}

    // Initialize state for each step in the workflow
    for (const step of workflow.steps) {
      stepState[step.id] = {
        stepId: step.id,
        status: "PENDING",
        podId: null,
        retriesLeft: step.retries ?? 0,
      }
    }

    const initialState: WorkflowState = {
      workflowId: workflow.workflowId,
      status: "running",
      steps: workflow.steps,
      stepState,
    }

    // IMPORTANT: Store workflow state before enqueueing the first ready step
    setWorkflow(workflow.workflowId, initialState)

    // Build current step status map for DAG resolution
    const currentStatusMap: Record<string, StepStatus> = {}
    for (const [stepId, state] of Object.entries(stepState)) {
      currentStatusMap[stepId] = state.status
    }

    // Find steps that have no dependencies and are ready to run
    const readySteps = getReadySteps(workflow.steps, currentStatusMap)

    // Mark ready steps as QUEUED and push them into stepQueue
    for (const readyStep of readySteps) {
      const state = initialState.stepState[readyStep.id]
      if (state) {
        state.status = "QUEUED"
      }

      await stepQueue.enqueue({
        stepId: readyStep.id,
        workflowId: workflow.workflowId,
        command: readyStep.command,
        enqueuedAt: Date.now(),
      })
    }

    // Save state after updating QUEUED steps
    setWorkflow(workflow.workflowId, initialState)
  }

  /**
   * Start consuming from result queue and draining step queue.
   */
  async start(): Promise<void> {
    if (this.isStarted) return
    this.isStarted = true

    // Start result queue consumer
    void resultQueue.consume(async (result) => {
      await this.handleStepResult(result)
    })

    // Start step queue worker loop
    void this.drainStepQueue()
  }

  /**
   * Process incoming StepResult events from PodManager.
   */
  private async handleStepResult(result: StepResult): Promise<void> {
    const workflowState = getWorkflow(result.workflowId)
    if (!workflowState) {
      console.error(`Workflow ${result.workflowId} not found in store`)
      return
    }

    const targetStep = workflowState.stepState[result.stepId]
    if (!targetStep) {
      console.error(`Step ${result.stepId} not found in workflow ${result.workflowId}`)
      return
    }

    // Update step state from result
    targetStep.status = result.status
    targetStep.podId = result.podId
    if (result.stdout !== undefined) targetStep.stdout = result.stdout
    if (result.exitCode !== undefined) targetStep.exitCode = result.exitCode
    if (result.error !== undefined) targetStep.error = result.error

    // On step completion, find and enqueue newly unblocked steps
    if (result.status === "COMPLETED") {
      const currentStatusMap: Record<string, StepStatus> = {}
      for (const [stepId, state] of Object.entries(workflowState.stepState)) {
        currentStatusMap[stepId] = state.status
      }

      const newlyReadySteps = getReadySteps(workflowState.steps, currentStatusMap)

      for (const readyStep of newlyReadySteps) {
        const state = workflowState.stepState[readyStep.id]
        if (state) {
          state.status = "QUEUED"
        }

        await stepQueue.enqueue({
          stepId: readyStep.id,
          workflowId: result.workflowId,
          command: readyStep.command,
          enqueuedAt: Date.now(),
        })
      }
    } else if (result.status === "FAILED") {
      // Retry failed steps if retriesLeft is remaining
      if (targetStep.retriesLeft && targetStep.retriesLeft > 0) {
        targetStep.retriesLeft -= 1
        targetStep.status = "QUEUED"

        const originalStep = workflowState.steps.find((s) => s.id === result.stepId)
        if (originalStep) {
          await stepQueue.enqueue({
            stepId: result.stepId,
            workflowId: result.workflowId,
            command: originalStep.command,
            enqueuedAt: Date.now(),
          })
        }
      }
    }

    // Recompute overall workflow status
    const allStepStates = Object.values(workflowState.stepState)
    const hasFailed = allStepStates.some((step) => step.status === "FAILED")
    const allCompleted = allStepStates.every((step) => step.status === "COMPLETED")

    if (hasFailed) {
      workflowState.status = "failed"
    } else if (allCompleted) {
      workflowState.status = "completed"
    } else {
      workflowState.status = "running"
    }

    setWorkflow(result.workflowId, workflowState)
  }

  /**
   * Drain step queue continuously and dispatch steps to PodManager.
   */
  private async drainStepQueue(): Promise<void> {
    while (true) {
      try {
        const queuedStep = await stepQueue.dequeue()
        if (queuedStep) {
          // Dispatch step execution asynchronously
          void podManager.dispatch(queuedStep)
        } else {
          // Idle delay when queue is empty
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error("Error in step queue worker loop:", error)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }
}

export const orchestrator = new Orchestrator()
