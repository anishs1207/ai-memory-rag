import {
  getShortTermContext,
  addMessage,
} from "./shortTermMemory.service.js";
import {
  storeLongTermMemory,
  searchLongTermMemory,
  formatLongTermContext,
} from "./longTermMemory.service.js";
import {
  upsertNode,
  upsertEdge,
  searchGraph,
  formatGraphContext,
} from "./knowledgeGraph.service.js";
import {
  extractMemoryFromConversation,
  extractFromSingleMessage,
} from "./memoryExtractor.service.js";
import type {
  MemoryRecallRequest,
  MemoryContext,
  ShortTermMessage,
} from "../types/memory.types.js";

export async function recallMemory(
  req: MemoryRecallRequest
): Promise<MemoryContext> {
  const start = Date.now();
  const {
    query,
    userId,
    sessionId,
    agentId,
    options = {},
  } = req;

  const {
    includeShortTerm = true,
    includeLongTerm = true,
    includeKnowledgeGraph = true,
    topKLongTerm = 5,
    topKGraph = 10,
    shortTermWindowSize = 10,
  } = options;

  // ── Run all recalls in parallel ───────────────────────────────────────────
  const [shortTermData, longTermResults, graphResults] = await Promise.all([
    includeShortTerm
      ? Promise.resolve(getShortTermContext(sessionId, shortTermWindowSize))
      : Promise.resolve({ messages: [] as any[], contextString: "", summary: undefined as string | undefined }),

    includeLongTerm
      ? searchLongTermMemory({
          query,
          userId,
          ...(agentId ? { agentId } : {}),
          topK: topKLongTerm,
          minScore: 0.45,
        })
      : Promise.resolve([]),

    includeKnowledgeGraph
      ? Promise.resolve(searchGraph(userId, query, topKGraph))
      : Promise.resolve({ nodes: [], edges: [] }),
  ]);

  // ── Build Composed Context ─────────────────────────────────────────────────
  const parts: string[] = [];

  const kgContext = formatGraphContext(graphResults);
  const ltContext = formatLongTermContext(longTermResults);

  if (kgContext) parts.push(kgContext);
  if (ltContext) parts.push(ltContext);
  if (shortTermData.contextString) parts.push(shortTermData.contextString);

  const composedContext = parts.join("\n\n");
  const shortTermSummary = (shortTermData as any).summary as string | undefined;

  return {
    shortTerm: {
      messages: shortTermData.messages || [],
      ...(shortTermSummary !== undefined ? { summary: shortTermSummary } : {}),
    },
    longTerm: {
      results: longTermResults,
      rawContext: ltContext,
    },
    knowledgeGraph: {
      relevantNodes: graphResults.nodes,
      relevantEdges: graphResults.edges,
      facts: graphResults.edges.map(
        (e) =>
          `${graphResults.nodes.find((n) => n.id === e.from)?.label} [${e.type}] ${graphResults.nodes.find((n) => n.id === e.to)?.label}`
      ),
    },
    composedContext,
    meta: {
      shortTermCount: shortTermData.messages?.length || 0,
      longTermCount: longTermResults.length,
      graphNodeCount: graphResults.nodes.length,
      recallTimeMs: Date.now() - start,
    },
  };
}

// ─── Memory Store (after conversation turn) ───────────────────────────────────
export async function consolidateMemory(params: {
  userId: string;
  sessionId: string;
  agentId?: string;
  recentMessages: ShortTermMessage[];
}): Promise<void> {
  const { userId, sessionId, agentId, recentMessages } = params;

  try {
    // 1️⃣ Extract entities and relations from recent messages
    const extracted = await extractMemoryFromConversation(
      recentMessages,
      userId
    );

    // 2️⃣ Store in Knowledge Graph
    for (const entity of extracted.entities) {
      if (entity.label && entity.type) {
        upsertNode(userId, {
          label: entity.label,
          type: entity.type,
          properties: entity.properties,
        });
      }
    }

    for (const relation of extracted.relations) {
      if (relation.from && relation.to && relation.type) {
        // Find source entity type
        const fromEntity = extracted.entities.find(
          (e) => e.label === relation.from
        );
        const toEntity = extracted.entities.find(
          (e) => e.label === relation.to
        );

        if (fromEntity && toEntity) {
          upsertEdge(userId, {
            fromLabel: fromEntity.label,
            fromType: fromEntity.type,
            toLabel: toEntity.label,
            toType: toEntity.type,
            type: relation.type,
            confidence: relation.confidence,
          });
        }
      }
    }

    // 3️⃣ Store summary in Long-Term Memory (if meaningful)
    if (extracted.summary && extracted.summary.length > 20) {
      const meta = await extractFromSingleMessage(extracted.summary);

      await storeLongTermMemory({
        userId,
        ...(agentId ? { agentId } : {}),
        content: extracted.summary,
        summary: extracted.summary,
        source: "conversation",
        tags: [...meta.tags, `session:${sessionId}`],
        importance: meta.importance,
        confidence: 1.0,
      }).catch(() => {}); // non-critical
    }

    // 4️⃣ Also store individual high-importance facts
    for (const fact of extracted.facts) {
      if (fact.confidence >= 0.8 && fact.subject && fact.object) {
        const factText = `${fact.subject} ${fact.predicate} ${fact.object}`;
        await storeLongTermMemory({
          userId,
          ...(agentId ? { agentId } : {}),
          content: factText,
          summary: factText,
          source: "extracted",
          tags: ["fact", fact.subject.toLowerCase()],
          importance: fact.confidence,
          confidence: fact.confidence,
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.error("[MemoryOrchestrator] Consolidation error:", err.message);
  }
}

// ─── Memory-Augmented Prompt Builder ─────────────────────────────────────────
export function buildMemoryAugmentedPrompt(params: {
  baseSystemPrompt: string;
  memoryContext: MemoryContext;
  userName?: string;
}): string {
  const { baseSystemPrompt, memoryContext, userName } = params;

  const memorySection = memoryContext.composedContext
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEMORY CONTEXT (use this to personalise your response)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${memoryContext.composedContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    : "";

  const userSection = userName ? `\nUser's name: ${userName}` : "";

  return `${baseSystemPrompt}${userSection}${memorySection}`;
}

// ─── Convenience: Chat with Memory ───────────────────────────────────────────
export async function memoryAwareChatSetup(params: {
  userId: string;
  sessionId: string;
  agentId?: string;
  userMessage: string;
}): Promise<MemoryContext> {
  const { userId, sessionId, agentId, userMessage } = params;

  // Recall first (before adding the new message)
  const memoryCtx = await recallMemory({
    query: userMessage,
    userId,
    sessionId,
    ...(agentId ? { agentId } : {}),
    options: {
      includeShortTerm: true,
      includeLongTerm: true,
      includeKnowledgeGraph: true,
    },
  });

  // Add user message to short-term
  await addMessage(sessionId, "user", userMessage).catch(() => {});

  return memoryCtx;
}

export async function memoryAwareChatFinalize(params: {
  userId: string;
  sessionId: string;
  agentId?: string;
  assistantResponse: string;
}): Promise<void> {
  const { userId, sessionId, agentId, assistantResponse } = params;

  // Add assistant response to short-term
  await addMessage(sessionId, "assistant", assistantResponse).catch(() => {});

  // Get recent messages for consolidation
  const { messages } = getShortTermContext(sessionId, 6);

  // Consolidate in background
  consolidateMemory({
    userId,
    sessionId,
    ...(agentId ? { agentId } : {}),
    recentMessages: messages,
  }).catch(() => {});
}
