import { Router } from "express";
import {ChatFinance, ChatLegal, ChatGeneral, uploadFile, queryMessageFromFile} from "../controllers/message.controller.js";
import { uploadMiddleware } from "@/middleware/multer.middleware.js";

const router = Router();

// make these work 
router.route("/chat").get(ChatGeneral);
router.route("/chat-legal").get(ChatLegal);
router.route("/chat-finance").get(ChatFinance);
// router.route("/upload-file").post(uploadMiddleware, uploadFile);
// router.route("/chat-file").post(queryMessageFromFile)

export default router;