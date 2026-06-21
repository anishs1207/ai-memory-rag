// ════════════════════════════════════════════════════════════════════════════
// MEMORY FRAMEWORK CONTROLLER
// REST API handlers for the memory framework
// ════════════════════════════════════════════════════════════════════════════

import type { Request, Response } from "express";
import { z } from "zod";
import {
  createSession,
  addMessage,
  getSession,
  getUserSessions,
  deleteSession,
  getShortTermContext,
  getShortTermStats,
} from "../services/shortTermMemory.service.js";
import {
  storeLongTermMemory,
  searchLongTermMemory,
  deleteLongTermMemory,
} from "../services/longTermMemory.service.js";
import {
  upsertNode,
  upsertEdge,
  searchGraph,
  getFullGraph,
  queryNodes,
  getNodeEdges,
  getGraphStats,
  deleteNode,
  applyDecay,
} from "../services/knowledgeGraph.service.js";
import {
  recallMemory,
  consolidateMemory,
  memoryAwareChatSetup,
  memoryAwareChatFinalize,
  buildMemoryAugmentedPrompt,
} from "../services/memoryOrchestrator.service.js";
import {
  extractMemoryFromConversation,
} from "../services/memoryExtractor.service.js";
import { geminiClient, getText } from "../utils/index.js";
import type { MemoryRecallRequest } from "../types/memory.types.js";

const kgNodeTypeSchema = z.enum([
  "Person",
  "Agent",
  "Project",
  "Concept",
  "Skill",
  "Goal",
  "Event",
  "Preference",
  "Belief",
  "Document",
  "Organization",
  "Location",
  "Topic"
]);

const kgEdgeTypeSchema = z.enum([
  "INTERESTED_IN",
  "LIKES",
  "DISLIKES",
  "WORKS_ON",
  "KNOWS",
  "HAS_SKILL",
  "HAS_GOAL",
  "EXPERIENCED",
  "BELIEVES",
  "RELATED_TO",
  "MENTIONED_IN",
  "DEPENDS_ON",
  "CREATED_BY",
  "PART_OF",
  "CONTRADICTS",
  "LEADS_TO",
  "SIMILAR_TO"
]);

// Helper: safely extract string route param or query
const p = (val: any): string => {
  if (val === undefined || val === null) return "";
  if (Array.isArray(val)) return String(val[0] ?? "");
  if (typeof val === "object") return ""; // ParsedQs or similar
  return String(val);
};

// ─── Session Management ───────────────────────────────────────────────────────

export const createMemorySession = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      agentId: z.string().optional(),
      systemPrompt: z.string().optional(),
    });
    const { userId, agentId, systemPrompt } = schema.parse(req.body);
    const session = createSession(userId, agentId, systemPrompt);
    return res.status(201).json({ success: true, data: session });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getMemorySession = async (req: Request, res: Response) => {
  try {
    const sessionId = p(req.params["sessionId"]);
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    return res.status(200).json({ success: true, data: session });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getUserMemorySessions = async (req: Request, res: Response) => {
  try {
    const userId = p(req.params["userId"]);
    const sessions = getUserSessions(userId);
    return res.status(200).json({ success: true, data: sessions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteMemorySession = async (req: Request, res: Response) => {
  try {
    const sessionId = p(req.params["sessionId"]);
    const deleted = deleteSession(sessionId);
    return res.status(200).json({ success: true, deleted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Short-Term Memory ────────────────────────────────────────────────────────

export const addMemoryMessage = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      sessionId: z.string().min(1, "sessionId is required"),
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1, "content is required"),
      metadata: z.record(z.string(), z.any()).optional(),
    });
    const { sessionId, role, content, metadata } = schema.parse(req.body);
    const session = await addMessage(sessionId, role, content, metadata);
    return res.status(200).json({ success: true, data: session });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getShortTermMemoryContext = async (req: Request, res: Response) => {
  try {
    const sessionId = p(req.params["sessionId"]);
    const windowSize = parseInt(p(req.query["windowSize"])) || 10;
    const context = getShortTermContext(sessionId, windowSize);
    return res.status(200).json({ success: true, data: context });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Long-Term Memory ─────────────────────────────────────────────────────────

export const storeLongTermMemoryEntry = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      agentId: z.string().optional(),
      content: z.string().min(1, "content is required"),
      summary: z.string().optional(),
      source: z.enum(["document", "conversation", "explicit", "extracted"]).optional().default("explicit"),
      tags: z.array(z.string()).optional(),
      importance: z.number().min(0).max(1).optional(),
      confidence: z.number().min(0).max(1).optional(),
    });
    const { userId, agentId, content, summary, source, tags, importance, confidence } = schema.parse(req.body);
    const entry = await storeLongTermMemory({
      userId,
      ...(agentId ? { agentId } : {}),
      content,
      ...(summary ? { summary } : {}),
      source,
      ...(tags ? { tags } : {}),
      ...(importance !== undefined ? { importance } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    });
    return res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const searchLongTermMemoryEntries = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      query: z.string().min(1, "query is required"),
      userId: z.string().min(1, "userId is required"),
      agentId: z.string().optional(),
      topK: z.number().int().min(1).optional(),
      filterSource: z.enum(["document", "conversation", "explicit", "extracted"]).optional(),
    });
    const { query, userId, agentId, topK, filterSource } = schema.parse(req.body);
    const results = await searchLongTermMemory({
      query,
      userId,
      ...(agentId ? { agentId } : {}),
      ...(topK ? { topK } : {}),
      ...(filterSource ? { filterSource } : {}),
    });
    return res.status(200).json({ success: true, data: results });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteLongTermMemoryEntry = async (req: Request, res: Response) => {
  try {
    const id = p(req.params["id"]);
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      agentId: z.string().optional(),
    });
    const { userId, agentId } = schema.parse(req.body);
    const deleted = await deleteLongTermMemory(id, userId, agentId);
    return res.status(200).json({ success: true, deleted });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export const upsertKGNode = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      label: z.string().min(1, "label is required"),
      type: kgNodeTypeSchema,
      properties: z.record(z.string(), z.any()).optional(),
      confidence: z.number().min(0).max(1).optional(),
    });
    const { userId, label, type, properties, confidence } = schema.parse(req.body);
    const node = upsertNode(userId, {
      label,
      type,
      ...(properties ? { properties } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    });
    return res.status(200).json({ success: true, data: node });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const upsertKGEdge = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      fromLabel: z.string().min(1, "fromLabel is required"),
      fromType: kgNodeTypeSchema.optional().default("Concept"),
      toLabel: z.string().min(1, "toLabel is required"),
      toType: kgNodeTypeSchema.optional().default("Concept"),
      type: kgEdgeTypeSchema,
      weight: z.number().optional(),
      confidence: z.number().min(0).max(1).optional(),
      properties: z.record(z.string(), z.any()).optional(),
    });
    const { userId, fromLabel, fromType, toLabel, toType, type, weight, confidence, properties } = schema.parse(req.body);
    const edge = upsertEdge(userId, {
      fromLabel,
      fromType,
      toLabel,
      toType,
      type,
      ...(weight !== undefined ? { weight } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      ...(properties ? { properties } : {}),
    });
    return res.status(200).json({ success: true, data: edge });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const searchKnowledgeGraph = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      query: z.string().min(1, "query is required"),
    });
    const { userId, query } = schema.parse(req.body);
    const limit = parseInt(p(req.query["limit"])) || 15;
    const result = searchGraph(userId, query, limit);
    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getFullKnowledgeGraph = async (req: Request, res: Response) => {
  try {
    const userId = p(req.params["userId"]);
    const graph = getFullGraph(userId);
    return res.status(200).json({ success: true, data: graph });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getKGNodeNeighbors = async (req: Request, res: Response) => {
  try {
    const userId = p(req.params["userId"]);
    const nodeId = p(req.params["nodeId"]);
    const result = getNodeEdges(userId, decodeURIComponent(nodeId));
    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getKGStats = async (req: Request, res: Response) => {
  try {
    const userId = p(req.params["userId"]);
    const stats = getGraphStats(userId);
    return res.status(200).json({ success: true, data: stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteKGNode = async (req: Request, res: Response) => {
  try {
    const userId = p(req.params["userId"]);
    const nodeId = p(req.params["nodeId"]);
    const deleted = deleteNode(userId, decodeURIComponent(nodeId));
    return res.status(200).json({ success: true, deleted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const applyMemoryDecay = async (req: Request, res: Response) => {
  try {
    const userId = p(req.params["userId"]);
    applyDecay(userId);
    return res.status(200).json({ success: true, message: "Memory decay applied" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Memory Orchestrator ──────────────────────────────────────────────────────

export const recallMemoryForQuery = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      query: z.string().min(1, "query is required"),
      userId: z.string().min(1, "userId is required"),
      sessionId: z.string().min(1, "sessionId is required"),
      agentId: z.string().optional(),
    });
    const recallReq = schema.parse(req.body) as MemoryRecallRequest;
    const context = await recallMemory(recallReq);
    return res.status(200).json({ success: true, data: context });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const consolidateMemoryForSession = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      sessionId: z.string().min(1, "sessionId is required"),
      agentId: z.string().optional(),
    });
    const { userId, sessionId, agentId } = schema.parse(req.body);
    const context = getShortTermContext(sessionId, 10);
    await consolidateMemory({
      userId,
      sessionId,
      ...(agentId ? { agentId } : {}),
      recentMessages: context.messages,
    });
    return res.status(200).json({ success: true, message: "Memory consolidated" });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const extractMemoryFromText = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })),
      userId: z.string().min(1, "userId is required"),
    });
    const { messages, userId } = schema.parse(req.body);
    const mappedMessages = messages.map((m) => ({
      id: "",
      role: m.role,
      content: m.content,
      timestamp: Date.now(),
    }));
    const extracted = await extractMemoryFromConversation(mappedMessages, userId);
    return res.status(200).json({ success: true, data: extracted });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Memory-Aware Chat ────────────────────────────────────────────────────────

export const memoryChat = async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "userId is required"),
      sessionId: z.string().min(1, "sessionId is required"),
      agentId: z.string().optional(),
      userMessage: z.string().min(1, "userMessage is required"),
      baseSystemPrompt: z.string().optional(),
    });
    const { userId, sessionId, agentId, userMessage, baseSystemPrompt } = schema.parse(req.body);

    // 1️⃣ Recall memory
    const memoryCtx = await memoryAwareChatSetup({
      userId,
      sessionId,
      ...(agentId ? { agentId } : {}),
      userMessage,
    });

    // 2️⃣ Build augmented prompt
    const systemPrompt = buildMemoryAugmentedPrompt({
      baseSystemPrompt: baseSystemPrompt || "You are a helpful AI assistant with access to your conversation memory.",
      memoryContext: memoryCtx,
    });

    const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nAssistant:`;

    // 3️⃣ Call LLM
    const result = await geminiClient(fullPrompt);
    const assistantResponse = getText(result);

    // 4️⃣ Finalise (store + consolidate)
    await memoryAwareChatFinalize({
      userId,
      sessionId,
      ...(agentId ? { agentId } : {}),
      assistantResponse,
    });

    return res.status(200).json({
      success: true,
      data: {
        response: assistantResponse,
        memoryMeta: memoryCtx.meta,
        memorySources: {
          shortTermMessages: memoryCtx.shortTerm.messages.length,
          longTermResults: memoryCtx.longTerm.results.length,
          graphNodes: memoryCtx.knowledgeGraph.relevantNodes.length,
        },
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: err.issues[0]?.message || "Validation Error" });
    }
    console.error("[MemoryChat] Error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Aggregate Stats ─────────────────────────────────────────────────────────

export const getMemoryStats = async (req: Request, res: Response) => {
  try {
    const userId = p(req.params["userId"]);
    const stStats = getShortTermStats(userId);
    const kgStats = getGraphStats(userId);

    return res.status(200).json({
      success: true,
      data: {
        userId,
        shortTerm: stStats,
        knowledgeGraph: kgStats,
        longTerm: { note: "Use /search for long-term memory entries" },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
