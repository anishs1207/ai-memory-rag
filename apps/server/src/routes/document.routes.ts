import { Router } from "express";
import { processDocument, saveExtractedData } from "../controllers/document.controller.js";
import { uploadMiddleware } from "@/middleware/multer.middleware.js";
import { fileUploadLimiter } from "../middleware/rateLimit.middleware.js";

// Rule 5: Prefer clear variable names over short ones
const documentRouter = Router();

// Route for processing uploaded documents (PDFs and images)
documentRouter.route("/process").post(fileUploadLimiter, uploadMiddleware, processDocument);

// Route for saving user-verified/modified document data
documentRouter.route("/save").post(saveExtractedData);

export default documentRouter;
