// ════════════════════════════════════════════════════════════════════════════
// MEMORY FRAMEWORK ROUTES
// All routes under /api/v1/memory/*
// ════════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { aiEndpointsLimiter } from "../middleware/rateLimit.middleware.js";
import {
  // Session
  createMemorySession,
  getMemorySession,
  getUserMemorySessions,
  deleteMemorySession,
  // Short-Term
  addMemoryMessage,
  getShortTermMemoryContext,
  // Long-Term
  storeLongTermMemoryEntry,
  searchLongTermMemoryEntries,
  deleteLongTermMemoryEntry,
  // Knowledge Graph
  upsertKGNode,
  upsertKGEdge,
  searchKnowledgeGraph,
  getFullKnowledgeGraph,
  getKGNodeNeighbors,
  getKGStats,
  deleteKGNode,
  applyMemoryDecay,
  // Orchestrator
  recallMemoryForQuery,
  consolidateMemoryForSession,
  extractMemoryFromText,
  memoryChat,
  // Stats
  getMemoryStats,
} from "../controllers/memoryFramework.controller.js";

const router = Router();

// ─── Session Routes ───────────────────────────────────────────────────────────
// POST   /api/v1/memory/session          → Create new session
// GET    /api/v1/memory/session/:id      → Get session
// DELETE /api/v1/memory/session/:id      → Delete session
// GET    /api/v1/memory/user/:userId/sessions → Get all sessions for user

router.post("/session", createMemorySession);
router.get("/session/:sessionId", getMemorySession);
router.delete("/session/:sessionId", deleteMemorySession);
router.get("/user/:userId/sessions", getUserMemorySessions);

// ─── Short-Term Memory Routes ─────────────────────────────────────────────────
// POST /api/v1/memory/short-term/message      → Add message to session
// GET  /api/v1/memory/short-term/:sessionId   → Get context for session

router.post("/short-term/message", addMemoryMessage);
router.get("/short-term/:sessionId", getShortTermMemoryContext);

// ─── Long-Term Memory Routes ──────────────────────────────────────────────────
// POST   /api/v1/memory/long-term           → Store new long-term memory
// POST   /api/v1/memory/long-term/search    → Semantic search
// DELETE /api/v1/memory/long-term/:id       → Delete entry

router.post("/long-term", storeLongTermMemoryEntry);
router.post("/long-term/search", searchLongTermMemoryEntries);
router.delete("/long-term/:id", deleteLongTermMemoryEntry);

// ─── Knowledge Graph Routes ───────────────────────────────────────────────────
// POST   /api/v1/memory/kg/node                     → Upsert node
// POST   /api/v1/memory/kg/edge                     → Upsert edge
// POST   /api/v1/memory/kg/search                   → Search graph
// GET    /api/v1/memory/kg/:userId/graph             → Full graph (visualise)
// GET    /api/v1/memory/kg/:userId/stats             → Graph stats
// GET    /api/v1/memory/kg/:userId/node/:nodeId      → Get node + neighbors
// DELETE /api/v1/memory/kg/:userId/node/:nodeId      → Delete node
// POST   /api/v1/memory/kg/:userId/decay             → Apply memory decay

router.post("/kg/node", upsertKGNode);
router.post("/kg/edge", upsertKGEdge);
router.post("/kg/search", searchKnowledgeGraph);
router.get("/kg/:userId/graph", getFullKnowledgeGraph);
router.get("/kg/:userId/stats", getKGStats);
router.get("/kg/:userId/node/:nodeId", getKGNodeNeighbors);
router.delete("/kg/:userId/node/:nodeId", deleteKGNode);
router.post("/kg/:userId/decay", applyMemoryDecay);

// ─── Orchestrator Routes ──────────────────────────────────────────────────────
// POST /api/v1/memory/recall        → Recall all memory layers for a query
// POST /api/v1/memory/consolidate   → Trigger memory consolidation
// POST /api/v1/memory/extract       → Extract structured memory from text
// POST /api/v1/memory/chat          → Memory-aware chat (full lifecycle)

router.post("/recall", recallMemoryForQuery);
router.post("/consolidate", consolidateMemoryForSession);
router.post("/extract", extractMemoryFromText);
router.post("/chat", aiEndpointsLimiter, memoryChat);

// ─── Stats Route ──────────────────────────────────────────────────────────────
// GET /api/v1/memory/stats/:userId  → Aggregate memory stats

router.get("/stats/:userId", getMemoryStats);

export default router;
