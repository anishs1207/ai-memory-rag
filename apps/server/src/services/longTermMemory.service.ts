import { randomUUID } from "crypto";
import { Pinecone } from "@pinecone-database/pinecone";
import { embedText } from "../lib/embedding.js";
import type {
  LongTermMemoryEntry,
  SemanticSearchResult,
} from "../types/memory.types.js";

const INDEX_NAME = "memory"; 

let _pinecone: Pinecone | null = null;
function getPinecone(): Pinecone {
  if (!_pinecone) {
    _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return _pinecone;
}

function userNamespace(userId: string, agentId?: string): string {
  return agentId ? `user_${userId}_agent_${agentId}` : `user_${userId}`;
}

export async function storeLongTermMemory(params: {
  userId: string;
  agentId?: string;
  content: string;
  summary?: string;
  source: LongTermMemoryEntry["source"];
  tags?: string[];
  importance?: number;
  confidence?: number;
}): Promise<LongTermMemoryEntry> {
  const {
    userId,
    agentId,
    content,
    summary,
    source,
    tags = [],
    importance = 0.5,
    confidence = 1.0,
  } = params;

  const id = randomUUID();
  const now = Date.now();
  const namespace = userNamespace(userId, agentId);

  // Generate embedding
  const embedding = await embedText(content);

  const entry: LongTermMemoryEntry = {
    id,
    userId,
    ...(agentId !== undefined ? { agentId } : {}),
    content,
    summary: summary || content.slice(0, 200),
    embedding,
    namespace,
    source,
    tags,
    importance,
    accessCount: 0,
    lastAccessed: now,
    createdAt: now,
    confidence,
  };

  // Upsert to Pinecone
  try {
    const pc = getPinecone();
    const index = pc.index(INDEX_NAME).namespace(namespace);
    await index.upsert([
      {
        id,
        values: embedding,
        metadata: {
          userId,
          agentId: agentId || "",
          content,
          summary: entry.summary,
          source,
          tags: tags.join(","),
          importance,
          confidence,
          accessCount: 0,
          lastAccessed: now,
          createdAt: now,
        },
      },
    ]);
  } catch (err: any) {
    // If index doesn't exist yet, we still return the entry
    // (graceful degradation — the KG and short-term still work)
    console.warn("[LongTermMemory] Pinecone upsert failed:", err.message);
  }

  return { ...entry, embedding: undefined };
}

/**
 * Semantic search over long-term memories.
 */
export async function searchLongTermMemory(params: {
  query: string;
  userId: string;
  agentId?: string;
  topK?: number;
  minScore?: number;
  filterSource?: LongTermMemoryEntry["source"];
  filterTags?: string[];
}): Promise<SemanticSearchResult[]> {
  const {
    query,
    userId,
    agentId,
    topK = 5,
    minScore = 0.5,
    filterSource,
    filterTags,
  } = params;

  const namespace = userNamespace(userId, agentId);
  const queryEmbedding = await embedText(query);

  try {
    const pc = getPinecone();
    const index = pc.index(INDEX_NAME).namespace(namespace);

    // Build metadata filter
    const filter: Record<string, any> = { userId: { $eq: userId } };
    if (filterSource) {
      filter.source = { $eq: filterSource };
    }

    const response = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter,
    });

    if (!response.matches) return [];

    const results: SemanticSearchResult[] = response.matches
      .filter((m) => (m.score ?? 0) >= minScore)
      .map((m) => {
        const meta = m.metadata as Record<string, any>;
        const entry: Omit<LongTermMemoryEntry, "embedding"> = {
          id: m.id,
          userId: meta.userId,
          ...(meta.agentId && meta.agentId !== "" ? { agentId: meta.agentId } : {}),
          content: meta.content,
          summary: meta.summary,
          namespace,
          source: meta.source,
          tags: meta.tags ? meta.tags.split(",") : [],
          importance: meta.importance,
          accessCount: meta.accessCount,
          lastAccessed: meta.lastAccessed,
          createdAt: meta.createdAt,
          confidence: meta.confidence,
        };

        return {
          entry,
          score: m.score ?? 0,
        };
      });

    // Update access counts in background
    results.forEach(async (r) => {
      try {
        const index2 = pc.index(INDEX_NAME).namespace(namespace);
        await index2.update({
          id: r.entry.id,
          metadata: {
            ...response.matches?.find((m) => m.id === r.entry.id)?.metadata,
            accessCount: (r.entry.accessCount || 0) + 1,
            lastAccessed: Date.now(),
          },
        });
      } catch {
        // non-critical
      }
    });

    return results;
  } catch (err: any) {
    console.warn("[LongTermMemory] Pinecone search failed:", err.message);
    return [];
  }
}

/**
 * Build a formatted context string from search results.
 */
export function formatLongTermContext(results: SemanticSearchResult[]): string {
  if (results.length === 0) return "";
  const lines = ["[RELEVANT LONG-TERM MEMORIES]"];
  results.forEach((r, i) => {
    lines.push(
      `${i + 1}. [${r.entry.source.toUpperCase()}] (relevance: ${(r.score * 100).toFixed(0)}%) ${r.entry.summary}`
    );
  });
  return lines.join("\n");
}

/**
 * Delete a specific memory entry.
 */
export async function deleteLongTermMemory(
  id: string,
  userId: string,
  agentId?: string
): Promise<boolean> {
  const namespace = userNamespace(userId, agentId);
  try {
    const pc = getPinecone();
    await pc.index(INDEX_NAME).namespace(namespace).deleteOne(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get stats for a user's long-term memory.
 */
export async function getLongTermStats(userId: string): Promise<{
  totalEntries: number;
  totalBySource: Record<string, number>;
  avgImportance: number;
}> {
  // Stats are approximated since Pinecone doesn't expose direct count APIs easily
  return {
    totalEntries: 0, // Would need a local index tracker for exact count
    totalBySource: {},
    avgImportance: 0,
  };
}
