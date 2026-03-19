import { Router } from "express";
import { generateAgentPersonas, conductElection, takeActionOnIssue, generateNews } from "@/controllers/panel.controller.js";

const router = Router();

router.route("/generate-personas").post(generateAgentPersonas);
router.route("/conduct-election").post(conductElection);
router.route("/take-action").post(takeActionOnIssue);
router.route("/generate-news").post(generateNews);

export default router;