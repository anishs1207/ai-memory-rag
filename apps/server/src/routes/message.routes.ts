import { Router } from "express";
import {ChatFinance, ChatLegal, ChatGeneral, uploadFile, queryMessageFromFile, getFiles} from "../controllers/message.controller.js";
import { uploadMiddleware } from "@/middleware/multer.middleware.js";
import { geminiClient, getText } from "@/utils/index.js";
import { generateResearchPDF } from "@/utils/pdf-gen.js";
import { randomUUID } from "crypto";
import { aiEndpointsLimiter, fileUploadLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

router.route("/general").post(aiEndpointsLimiter, ChatGeneral);
router.route("/legal").post(aiEndpointsLimiter, ChatLegal);
router.route("/finance").post(aiEndpointsLimiter, ChatFinance);
router.route("/upload-file").post(fileUploadLimiter, uploadMiddleware, uploadFile);
router.route("/chat-file").post(aiEndpointsLimiter, queryMessageFromFile);
router.route("/get-files").get(getFiles);
router.route("/budget").post(aiEndpointsLimiter, (req, res) => res.status(200).json({ success: true, message: "Budget context received" }));
router.route("/research").post(aiEndpointsLimiter, async (req, res) => {
    const { topic } = req.body;
    try {
        const researchPrompt = `Generate a research document in LaTeX format about: ${topic}. Include sections like Abstract, Introduction, Methodology, and Conclusion.`;
        const aiResponse = await geminiClient(researchPrompt);
        const latexContent = getText(aiResponse);
        
        const fileName = `research-${Date.now()}.pdf`;
        const pdfUrl = await generateResearchPDF(topic, latexContent, fileName);
        
        return res.status(200).json({ 
            success: true, 
            data: latexContent,
            pdfUrl: pdfUrl 
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

export default router;