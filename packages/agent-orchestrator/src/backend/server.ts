import express from "express"
import { podPool } from "../k8s/pod-pool.js"
import { orchestrator } from "./orchestrator.js"
import { getWorkflow } from "./workflow-store.js"
import type { Workflow } from "../types/workflow.js"

const app = express()
app.use(express.json())

// POST /workflow
// Submits a new workflow: stores initial state, resolves ready steps, and enqueues them
app.post("/workflow", async (req, res) => {
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
})

// GET /workflow/:id
// Reads and returns current workflow state from workflow-store
app.get("/workflow/:id", (req, res) => {
  const workflowId = req.params.id
  const state = getWorkflow(workflowId)

  if (!state) {
    res.status(404).json({ error: `Workflow with id '${workflowId}' not found.` })
    return
  }

  res.json(state)
})

// GET /pods — returns current Kubernetes pod pool lease status
app.get("/pods", async (_req, res) => {
  const status = podPool.getPoolStatus()
  res.json(status)
})

export { app }
