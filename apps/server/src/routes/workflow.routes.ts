import { Router } from "express"
import {
  submitWorkflowHandler,
  getWorkflowHandler,
  getPodsHandler,
} from "../controllers/workflow.controller.js"

const router = Router()

// Workflow execution and monitoring routes
router.post("/workflow", submitWorkflowHandler)
router.get("/workflow/:id", getWorkflowHandler)
router.get("/pods", getPodsHandler)

// Support sub-router endpoints when mounted at /api/v1/workflow
router.post("/", submitWorkflowHandler)
router.get("/:id", getWorkflowHandler)

export default router
