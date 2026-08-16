import type { QueuedStep, Pod } from "../types/workflow.js"
import { runnerPool } from "../runner/runner-pool.js"
import { resultQueue } from "../queue/result-queue.js"

/**
 * PodManager receives a queued step, leases an execution runner,
 * runs the command, and publishes status events to resultQueue.
 */
export class PodManager {
  async dispatch(step: QueuedStep): Promise<void> {
    let leasedPod: Pod | null = null

    // Acquire a free pod from the pool, retrying if pool is temporarily exhausted
    while (!leasedPod) {
      try {
        leasedPod = await runnerPool.acquirePod()
      } catch (error: unknown) {
        if (error instanceof Error && error.message === "NO_POD_AVAILABLE") {
          // Wait briefly before retrying pod acquisition
          await new Promise((resolve) => setTimeout(resolve, 100))
        } else {
          // Unexpected error while acquiring pod
          const errorMessage = error instanceof Error ? error.message : String(error)
          await resultQueue.push({
            stepId: step.stepId,
            workflowId: step.workflowId,
            podId: "",
            status: "FAILED",
            error: errorMessage,
          })
          return
        }
      }
    }

    const podId = leasedPod.podId

    try {
      // Step 1: Notify orchestrator that the step is running inside the leased pod
      await resultQueue.push({
        stepId: step.stepId,
        workflowId: step.workflowId,
        podId,
        status: "RUNNING",
      })

      // Step 2: Execute command inside container
      const stdout = await runnerPool.execInPod(podId, step.command)

      // Step 3: Publish completed status with command output
      await resultQueue.push({
        stepId: step.stepId,
        workflowId: step.workflowId,
        podId,
        status: "COMPLETED",
        stdout,
        exitCode: 0,
      })
    } catch (error: unknown) {
      // Handle command execution failure
      const errorMessage = error instanceof Error ? error.message : String(error)
      await resultQueue.push({
        stepId: step.stepId,
        workflowId: step.workflowId,
        podId,
        status: "FAILED",
        error: errorMessage,
      })
    } finally {
      // Step 4: Always release pod back to pool for next step
      await runnerPool.releasePod(podId)
    }
  }
}

export const podManager = new PodManager()
