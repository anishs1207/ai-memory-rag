import type { Request, Response } from "express";
import { z } from "zod";
import { runRAG, generateLegalPrompt, generateFinancePrompt } from "@/services/rag.service.js";
import { geminiClient, parseResult, getText } from "@/utils/index.js";
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { randomUUID } from "crypto";
import { Pinecone } from "@pinecone-database/pinecone";
import { embedText } from "@/lib/embedding.js";
import LandingAIADE from "landingai-ade";
import { documentQueue } from "@/lib/queue.js";

interface EmbeddingContext {
  name: string;
  description: string;
  chunkIndex: number;
  score: number;
}

type RAGResult = {
  answer: string;
  sources: {
    fileName: string;
    chunkIndex: number;
    score?: number;
  }[];
};

function isProviderQuotaError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 429;
}

const ChatLegal = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      prompt: z.string().min(1, "Prompt is required"),
      llm: z.string().optional(),
    });
    const { prompt, llm } = schema.parse(req.body);

    const embeddingContexts: EmbeddingContext[] = await runRAG(prompt, "./vector-db/legal-vector-db");

    console.log("context:", embeddingContexts);

    const bigPrompt = generateLegalPrompt(prompt, embeddingContexts);

    const aiResponse = await geminiClient(bigPrompt, llm);

    if (!aiResponse) {
      return res.status(400).json({
        success: false,
        error: "AI Response is not given"
      })
    }

    const result = parseResult(aiResponse);
    const responseText = typeof result === 'string' ? result : (result.response || JSON.stringify(result));

    return res.status(200).json({
      success: true,
      data: responseText,
      sources: embeddingContexts.map((context) => ({
        name: context.name,
        chunkIndex: context.chunkIndex,
        content: context.description,
        score: context.score,
      })),
    })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: err.issues[0]?.message || "Validation Error"
      });
    }
    console.error("ChatLegal Error:", err)
    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error"
    })
  }

}

const ChatFinance = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      prompt: z.string().min(1, "Prompt is required"),
      llm: z.string().optional(),
    });
    const { prompt, llm } = schema.parse(req.body);

    const embeddingContexts: EmbeddingContext[] = await runRAG(prompt, "./vector-db/finance-vector-db");

    console.log("context:", embeddingContexts);

    const bigPrompt = generateFinancePrompt(prompt, embeddingContexts);

    const aiResponse = await geminiClient(bigPrompt, llm);

    if (!aiResponse) {
      return res.status(400).json({
        success: false,
        error: "AI Response is not given"
      })
    }

    const result = parseResult(aiResponse);
    const responseText = typeof result === 'string' ? result : (result.response || JSON.stringify(result));

    return res.status(200).json({
      success: true,
      data: responseText,
      sources: embeddingContexts.map((context) => ({
        name: context.name,
        chunkIndex: context.chunkIndex,
        content: context.description,
        score: context.score,
      })),
    })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: err.issues[0]?.message || "Validation Error"
      });
    }
    console.error("ChatFinance Error:", err)
    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error"
    })
  }
}

const ChatGeneral = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      prompt: z.string().min(1, "Prompt is required"),
      llm: z.string().optional(),
    });
    const { prompt, llm } = schema.parse(req.body);

    const bigPrompt = `
          <agent>
          You are a helpful general assistant. Answer clearly and concisely.
          </agent>

          user asked:
          ${prompt}
        `
    const aiResponse = await geminiClient(bigPrompt, llm);

    console.log("apiResponse", aiResponse);

    if (!aiResponse) {
      return res.status(400).json({
        success: false,
        error: "Error getting response"
      })
    }

    const responseText = getText(aiResponse);

    console.log("responseText", responseText);

    return res.status(200).json({
      success: true,
      data: responseText
    })

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: err.issues[0]?.message || "Validation Error"
      });
    }
    if (isProviderQuotaError(err)) {
      console.warn("ChatGeneral: Claude rate limit or quota exhausted")
      return res.status(429).json({
        success: false,
        error: "Claude API rate limit or quota is exhausted. Wait and retry, check Anthropic billing, or select the local SmolLM model.",
      })
    }
    console.error("ChatGeneral Error:", err)
    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error"
    })
  }
}

export let _pinecone: Pinecone | null = null;
export function getPinecone(): Pinecone {
  if (!_pinecone) {
    _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return _pinecone;
}

export const INDEX_NAME = "documents";

export async function readFileContent(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  } else {
    return fs.readFileSync(filePath, "utf-8");
  }
}

export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function uploadFile(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "File is required" });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    // Add task to background queue
    const job = await documentQueue.add("index-file", {
      filePath,
      fileName,
    });

    return res.status(200).json({
      success: true,
      message: `File "${fileName}" uploaded and queued for indexing successfully!`,
      jobId: job.id,
      fileName,
    });
  } catch (err: any) {
    console.error("Error queueing upload file:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) { }
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function getUploadStatus(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    if (!jobId || typeof jobId !== "string") {
      return res.status(400).json({ success: false, error: "Job ID is required and must be a string" });
    }

    const job = await documentQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: "Job not found" });
    }

    const state = await job.getState();
    const progress = job.progress || { processed: 0, total: 0, percentage: 0 };
    const failedReason = job.failedReason;

    return res.status(200).json({
      success: true,
      data: {
        jobId: job.id,
        state,
        progress,
        failedReason,
      },
    });
  } catch (err: any) {
    console.error("Error getting upload status:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

const queryMessageFromFile = async (
  req: Request,
  res: Response
) => {
  try {
    const schema = z.object({
      fileName: z.string().min(1, "fileName is required"),
      prompt: z.string().min(1, "prompt is required"),
      topK: z.number().int().min(1).optional().default(5),
      legalMode: z.boolean().optional().default(false),
      llm: z.string().optional(),
    });
    const { fileName, prompt, topK, legalMode, llm } = schema.parse(req.body);
    const queryEmbedding = await embedText(prompt);
    const index = getPinecone().index(INDEX_NAME);

    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: {
        fileName: { $eq: fileName },
      },
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          answer: "No relevant information found in this document.",
          sources: [],
        } satisfies RAGResult,
      });
    }

    const context = queryResponse.matches
      .map((match, i) => {
        return `Chunk ${i + 1}:\n${match.metadata?.text ?? ""}`;
      })
      .join("\n\n");

    const systemPrompt = legalMode
      ? `You are a legal assistant. Answer strictly using the provided document context.
        If the answer is not present, say "The document does not contain this information."`
      : `You are a helpful assistant. Use the provided context to answer the question.`;

    const finalPrompt = `
        ${systemPrompt}

        DOCUMENT CONTEXT:
        ${context}

        USER QUESTION:
        ${prompt}

        ANSWER:
`;

    const aiResponse = await geminiClient(finalPrompt, llm);
    const answer = getText(aiResponse);

    const result: RAGResult = {
      answer,
      //@ts-expect-error
      sources: queryResponse.matches.map((m) => ({
        fileName: m.metadata?.fileName as string,
        chunkIndex: m.metadata?.chunkIndex as number,
        score: m.score,
      })),
    };

    return res.status(200).json({
      success: true,
      data: answer,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: err.issues[0]?.message || "Validation Error"
      });
    }
    console.error("RAG query error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to query document",
    });
  }
};

async function getFiles(req: Request, res: Response) {
  try {
    const index = getPinecone().index(INDEX_NAME);
    const filesPath = path.join(process.cwd(), "uploads", "files.json");
    let files = [];
    if (fs.existsSync(filesPath)) {
      files = JSON.parse(fs.readFileSync(filesPath, "utf-8"));
    }
    return res.status(200).json({ success: true, data: files });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export { ChatFinance, ChatLegal, ChatGeneral, queryMessageFromFile, uploadFile, getFiles, getUploadStatus };
