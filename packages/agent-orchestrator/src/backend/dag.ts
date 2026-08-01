import type { WorkflowStep, StepStatus } from "../types/workflow.js"

/**
 * Returns all steps in a workflow that are ready to run.
 * A step is ready if:
 * 1. Its current status is "PENDING".
 * 2. All steps listed in its dependsOn array have status "COMPLETED".
 */
export function getReadySteps(
  steps: WorkflowStep[],
  stepStatus: Record<string, StepStatus>
): WorkflowStep[] {
  return steps.filter((step) => {
    // Only steps currently marked as PENDING can be readied
    const currentStatus = stepStatus[step.id]
    if (currentStatus !== "PENDING") {
      return false
    }

    // If step has no dependencies, it is ready to run immediately
    if (!step.dependsOn || step.dependsOn.length === 0) {
      return true
    }

    // Verify all parent dependency steps are COMPLETED
    return step.dependsOn.every((dependencyId) => stepStatus[dependencyId] === "COMPLETED")
  })
}
