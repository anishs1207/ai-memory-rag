// ════════════════════════════════════════════════════════════════════════════
// MEMORY FRAMEWORK CONTROLLER
// REST API handlers for the memory framework
// ════════════════════════════════════════════════════════════════════════════

import type { Request, Response } from "express";
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

// Helper: safely extract string route param
const p = (val: string | string[] | undefined): string =>
  Array.isArray(val) ? (val[0] ?? "") : (val ?? "");

// ─── Session Management ───────────────────────────────────────────────────────

export const createMemorySession = async (req: Request, res: Response) => {
  try {
    const { userId, agentId, systemPrompt } = req.body as Record<string, string>;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    const session = createSession(userId, agentId, systemPrompt);
    return res.status(201).json({ success: true, data: session });
  } catch (err: any) {
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
    const { sessionId, role, content, metadata } = req.body;
    if (!sessionId || !role || !content) {
      return res.status(400).json({ success: false, error: "sessionId, role, content required" });
    }
    const session = await addMessage(sessionId, role, content, metadata);
    return res.status(200).json({ success: true, data: session });
  } catch (err: any) {
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
    const { userId, agentId, content, summary, source, tags, importance, confidence } = req.body;
    if (!userId || !content) {
      return res.status(400).json({ success: false, error: "userId and content required" });
    }
    const entry = await storeLongTermMemory({
      userId,
      ...(agentId ? { agentId } : {}),
      content,
      ...(summary ? { summary } : {}),
      source: source || "explicit",
      ...(tags ? { tags } : {}),
      ...(importance !== undefined ? { importance } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    });
    return res.status(201).json({ success: true, data: entry });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const searchLongTermMemoryEntries = async (req: Request, res: Response) => {
  try {
    const { query, userId, agentId, topK, filterSource } = req.body;
    if (!query || !userId) {
      return res.status(400).json({ success: false, error: "query and userId required" });
    }
    const results = await searchLongTermMemory({
      query,
      userId,
      ...(agentId ? { agentId } : {}),
      ...(topK ? { topK } : {}),
      ...(filterSource ? { filterSource } : {}),
    });
    return res.status(200).json({ success: true, data: results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteLongTermMemoryEntry = async (req: Request, res: Response) => {
  try {
    const id = p(req.params["id"]);
    const { userId, agentId } = req.body;
    const deleted = await deleteLongTermMemory(id, userId, agentId);
    return res.status(200).json({ success: true, deleted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export const upsertKGNode = async (req: Request, res: Response) => {
  try {
    const { userId, label, type, properties, confidence } = req.body;
    if (!userId || !label || !type) {
      return res.status(400).json({ success: false, error: "userId, label, type required" });
    }
    const node = upsertNode(userId, {
      label,
      type,
      ...(properties ? { properties } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
    });
    return res.status(200).json({ success: true, data: node });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const upsertKGEdge = async (req: Request, res: Response) => {
  try {
    const { userId, fromLabel, fromType, toLabel, toType, type, weight, confidence, properties } = req.body;
    if (!userId || !fromLabel || !toLabel || !type) {
      return res.status(400).json({ success: false, error: "userId, fromLabel, toLabel, type required" });
    }
    const edge = upsertEdge(userId, {
      fromLabel,
      fromType: fromType || "Concept",
      toLabel,
      toType: toType || "Concept",
      type,
      ...(weight !== undefined ? { weight } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      ...(properties ? { properties } : {}),
    });
    return res.status(200).json({ success: true, data: edge });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const searchKnowledgeGraph = async (req: Request, res: Response) => {
  try {
    const { userId, query } = req.body;
    const limit = parseInt(p(req.query["limit"])) || 15;
    if (!userId || !query) {
      return res.status(400).json({ success: false, error: "userId and query required" });
    }
    const result = searchGraph(userId, query, limit);
    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
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
    const recallReq: MemoryRecallRequest = req.body;
    if (!recallReq.query || !recallReq.userId || !recallReq.sessionId) {
      return res.status(400).json({ success: false, error: "query, userId, sessionId required" });
    }
    const context = await recallMemory(recallReq);
    return res.status(200).json({ success: true, data: context });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const consolidateMemoryForSession = async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, agentId } = req.body;
    if (!userId || !sessionId) {
      return res.status(400).json({ success: false, error: "userId and sessionId required" });
    }
    const context = getShortTermContext(sessionId, 10);
    await consolidateMemory({
      userId,
      sessionId,
      ...(agentId ? { agentId } : {}),
      recentMessages: context.messages,
    });
    return res.status(200).json({ success: true, message: "Memory consolidated" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const extractMemoryFromText = async (req: Request, res: Response) => {
  try {
    const { messages, userId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: "messages array required" });
    }
    const extracted = await extractMemoryFromConversation(messages, userId);
    return res.status(200).json({ success: true, data: extracted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Memory-Aware Chat ────────────────────────────────────────────────────────

export const memoryChat = async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, agentId, userMessage, baseSystemPrompt } = req.body;

    if (!userId || !sessionId || !userMessage) {
      return res.status(400).json({
        success: false,
        error: "userId, sessionId, userMessage are required",
      });
    }

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
