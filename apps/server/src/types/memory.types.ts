// ════════════════════════════════════════════════════════════════════════════
// PAXIO MEMORY FRAMEWORK — Core Type Definitions
// Based on: MemGPT, CoALA, HippoRAG, GraphRAG, PageAgent research
// ════════════════════════════════════════════════════════════════════════════

// ─── SHORT-TERM MEMORY ───────────────────────────────────────────────────────

export interface ShortTermMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: Record<string, any> | undefined;
}

export interface ShortTermMemory {
  sessionId: string;
  userId: string;
  agentId?: string | undefined;
  messages: ShortTermMessage[];
  summary?: string | undefined; // Compressed summary when window overflows
  workingContext?: string | undefined; // Dynamically injected working memory
  createdAt: number;
  updatedAt: number;
  maxWindowSize: number; // Default: 20 messages
}

// ─── LONG-TERM MEMORY (Vector / Semantic) ────────────────────────────────────

export interface LongTermMemoryEntry {
  id: string;
  userId: string;
  agentId?: string | undefined;
  content: string; // The raw memory content
  summary: string; // Compressed version for quick recall
  embedding?: number[] | undefined; // Vector representation
  namespace: string; // Pinecone namespace: user_{userId}
  source: "conversation" | "document" | "explicit" | "extracted";
  tags: string[];
  importance: number; // 0.0 - 1.0
  accessCount: number; // How many times recalled
  lastAccessed: number;
  createdAt: number;
  confidence: number; // 0.0 - 1.0 — degrades over time
}

export interface SemanticSearchResult {
  entry: Omit<LongTermMemoryEntry, "embedding">;
  score: number;
  highlights?: string[];
}

// ─── KNOWLEDGE GRAPH ─────────────────────────────────────────────────────────

export type KGNodeType =
  | "Person"
  | "Agent"
  | "Project"
  | "Concept"
  | "Skill"
  | "Goal"
  | "Event"
  | "Preference"
  | "Belief"
  | "Document"
  | "Organization"
  | "Location"
  | "Topic";

export type KGEdgeType =
  | "INTERESTED_IN"
  | "LIKES"
  | "DISLIKES"
  | "WORKS_ON"
  | "KNOWS"
  | "HAS_SKILL"
  | "HAS_GOAL"
  | "EXPERIENCED"
  | "BELIEVES"
  | "RELATED_TO"
  | "MENTIONED_IN"
  | "DEPENDS_ON"
  | "CREATED_BY"
  | "PART_OF"
  | "CONTRADICTS"
  | "LEADS_TO"
  | "SIMILAR_TO";

export interface KGNode {
  id: string; // e.g. "user:anish", "concept:rag"
  type: KGNodeType;
  label: string; // Human-readable name
  properties: Record<string, any>;
  userId?: string;
  embedding?: number[]; // For semantic node search
  confidence: number; // 0.0 - 1.0
  createdAt: number;
  updatedAt: number;
  lastSeen: number;
  occurrences: number; // How many times seen in conversations
}

export interface KGEdge {
  id: string;
  from: string; // Node ID
  to: string; // Node ID
  type: KGEdgeType;
  weight: number; // 0.0 - 1.0 — relation strength
  confidence: number; // 0.0 - 1.0
  properties?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  occurrences: number; // How many times this relation seen
}

export interface KnowledgeGraph {
  userId: string;
  nodes: Map<string, KGNode>;
  edges: Map<string, KGEdge>;
  meta: {
    totalNodes: number;
    totalEdges: number;
    lastUpdated: number;
  };
}

export interface GraphQueryResult {
  nodes: KGNode[];
  edges: KGEdge[];
  paths?: KGNode[][];
}

// ─── EXTRACTED FACTS ─────────────────────────────────────────────────────────

export interface ExtractedFact {
  subject: string; // Entity subject
  predicate: string; // Relationship
  object: string; // Entity object
  confidence: number;
  source: string; // Session/conversation ID
}

export interface ExtractedEntities {
  entities: Array<{
    label: string;
    type: KGNodeType;
    properties: Record<string, any>;
  }>;
  relations: Array<{
    from: string;
    to: string;
    type: KGEdgeType;
    confidence: number;
  }>;
  facts: ExtractedFact[];
  summary: string; // One-line memory summary of the conversation chunk
}

// ─── MEMORY ORCHESTRATOR ─────────────────────────────────────────────────────

export interface MemoryRecallRequest {
  query: string;
  userId: string;
  sessionId: string;
  agentId?: string;
  options?: {
    includeShortTerm?: boolean; // default: true
    includeLongTerm?: boolean; // default: true
    includeKnowledgeGraph?: boolean; // default: true
    topKLongTerm?: number; // default: 5
    topKGraph?: number; // default: 10
    shortTermWindowSize?: number; // default: 10
  };
}

export interface MemoryContext {
  shortTerm: {
    messages: ShortTermMessage[];
    summary?: string | undefined;
  };
  longTerm: {
    results: SemanticSearchResult[];
    rawContext: string;
  };
  knowledgeGraph: {
    relevantNodes: KGNode[];
    relevantEdges: KGEdge[];
    facts: string[];
  };
  composedContext: string; // Final string injected into LLM prompt
  meta: {
    shortTermCount: number;
    longTermCount: number;
    graphNodeCount: number;
    recallTimeMs: number;
  };
}

// ─── MEMORY STATS ────────────────────────────────────────────────────────────

export interface MemoryStats {
  userId: string;
  shortTerm: {
    totalSessions: number;
    totalMessages: number;
    avgMessagesPerSession: number;
  };
  longTerm: {
    totalEntries: number;
    totalBySource: Record<string, number>;
    avgImportance: number;
  };
  knowledgeGraph: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    topEntities: Array<{ label: string; occurrences: number }>;
  };
}
