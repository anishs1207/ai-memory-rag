import { Router } from "express";
import {ChatFinance, ChatLegal, ChatGeneral, uploadFile, queryMessageFromFile, getFiles} from "../controllers/message.controller.js";
import { uploadMiddleware } from "@/middleware/multer.middleware.js";

const router = Router();

// make these work 
router.route("/general").post(ChatGeneral);
router.route("/legal").post(ChatLegal);
router.route("/finance").post(ChatFinance);
// do these routes later gere
router.route("/upload-file").post(uploadMiddleware, uploadFile);
router.route("/chat-file").post(queryMessageFromFile);
router.route("/get-files").get(getFiles);

export default router;