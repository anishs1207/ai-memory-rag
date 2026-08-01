import type { Request, Response } from "express"
import { orchestrator, getWorkflow, podPool, type Workflow } from "@inqora/common"

/**
 * Controller for submitting a new workflow.
 * Receives the workflow payload, validates it, and submits it to the orchestrator.
 */
export async function submitWorkflowHandler(req: Request, res: Response): Promise<void> {
  const workflow = req.body as Workflow

  if (!workflow || !workflow.workflowId || !Array.isArray(workflow.steps)) {
    res.status(400).json({ error: "Invalid workflow format. Required: workflowId and steps array." })
    return
  }

  try {
    await orchestrator.submitWorkflow(workflow)
    res.status(202).json({ message: "Workflow submitted successfully", workflowId: workflow.workflowId })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({ error: errorMessage })
  }
}

/**
 * Controller for retrieving workflow execution status.
 */
export function getWorkflowHandler(req: Request, res: Response): void {
  const rawWorkflowId = req.params.id
  const workflowId = Array.isArray(rawWorkflowId) ? rawWorkflowId[0] : rawWorkflowId

  if (!workflowId) {
    res.status(400).json({ error: "Workflow ID parameter is required" })
    return
  }

  const state = getWorkflow(workflowId)
  if (!state) {
    res.status(404).json({ error: `Workflow with id '${workflowId}' not found.` })
    return
  }

  res.json(state)
}

/**
 * Controller for getting current Kubernetes pod pool lease status.
 */
export function getPodsHandler(_req: Request, res: Response): void {
  const status = podPool.getPoolStatus()
  res.json(status)
}
