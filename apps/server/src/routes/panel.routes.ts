import { Router } from "express";
import { generateAgentPersonas, conductElection, takeActionOnIssue } from "@/controllers/panel.controller.js";

const router = Router();

router.route("/generate-personas").post(generateAgentPersonas);
router.route("/conduct-election").post(conductElection);
router.route("/take-action").post(takeActionOnIssue);

export default router;