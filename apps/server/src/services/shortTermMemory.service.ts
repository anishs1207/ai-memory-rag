// ════════════════════════════════════════════════════════════════════════════
// SHORT-TERM MEMORY SERVICE
// Strategy: Sliding Window (last N messages) + Overflow Summarisation
// Inspired by: MemGPT's working memory tier
// ════════════════════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  ShortTermMessage,
  ShortTermMemory,
} from "../types/memory.types.js";
import { geminiClient, getText } from "../utils/index.js";

const STORAGE_DIR = path.join(process.cwd(), "memory-store", "short-term");
const MAX_WINDOW_SIZE = 20; // default rolling window
const SUMMARY_TRIGGER = 25; // summarise when messages exceed this

// ─── Persistence Helpers ─────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function sessionPath(sessionId: string): string {
  return path.join(STORAGE_DIR, `${sessionId}.json`);
}

function readSession(sessionId: string): ShortTermMemory | null {
  const p = sessionPath(sessionId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as ShortTermMemory;
  } catch {
    return null;
  }
}

function writeSession(memory: ShortTermMemory): void {
  ensureDir();
  fs.writeFileSync(sessionPath(memory.sessionId), JSON.stringify(memory, null, 2));
}

// ─── Summarisation ───────────────────────────────────────────────────────────

async function summariseMessages(messages: ShortTermMessage[]): Promise<string> {
  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const prompt = `
You are a memory compression agent. Summarise the following conversation into a concise, factual paragraph (max 200 words).
Focus on: key topics discussed, decisions made, important facts mentioned, preferences expressed, and unresolved questions.
Do NOT include pleasantries or filler phrases. Be dense and informative.

CONVERSATION:
${transcript}

COMPRESSED SUMMARY:
`;

  const result = await geminiClient(prompt);
  return getText(result).trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new memory session for a user.
 */
export function createSession(
  userId: string,
  agentId?: string,
  systemPrompt?: string
): ShortTermMemory {
  const session: ShortTermMemory = {
    sessionId: randomUUID(),
    userId,
    ...(agentId !== undefined ? { agentId } : {}),
    messages: systemPrompt
      ? [
          {
            id: randomUUID(),
            role: "system",
            content: systemPrompt,
            timestamp: Date.now(),
          },
        ]
      : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    maxWindowSize: MAX_WINDOW_SIZE,
  };
  writeSession(session);
  return session;
}

/**
 * Add a message to a session's short-term memory.
 * Triggers automatic summarisation when window is full.
 */
export async function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: Record<string, any>
): Promise<ShortTermMemory> {
  let session = readSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const msg: ShortTermMessage = {
    id: randomUUID(),
    role,
    content,
    timestamp: Date.now(),
    ...(metadata !== undefined ? { metadata } : {}),
  };

  session.messages.push(msg);
  session.updatedAt = Date.now();

  // Overflow: summarise older half + keep recent
  if (session.messages.length >= SUMMARY_TRIGGER) {
    const nonSystem = session.messages.filter((m) => m.role !== "system");
    const systemMsgs = session.messages.filter((m) => m.role === "system");
    const toSummarise = nonSystem.slice(0, Math.floor(nonSystem.length / 2));
    const toKeep = nonSystem.slice(Math.floor(nonSystem.length / 2));

    const newSummary = await summariseMessages(toSummarise);
    session.summary = session.summary
      ? `${session.summary}\n\n[Later]: ${newSummary}`
      : newSummary;

    session.messages = [...systemMsgs, ...toKeep];
  }

  writeSession(session);
  return session;
}

/**
 * Get a session's full memory state.
 */
export function getSession(sessionId: string): ShortTermMemory | null {
  return readSession(sessionId);
}

/**
 * Get formatted context string from a session (for LLM injection).
 */
export function getShortTermContext(
  sessionId: string,
  windowSize = MAX_WINDOW_SIZE
): { messages: ShortTermMessage[]; summary?: string; contextString: string } {
  const session = readSession(sessionId);
  if (!session)
    return { messages: [], contextString: "No prior conversation found." };

  const recentMessages = session.messages
    .filter((m) => m.role !== "system")
    .slice(-windowSize);

  const lines: string[] = [];

  if (session.summary) {
    lines.push(`[CONVERSATION SUMMARY]\n${session.summary}\n`);
  }

  lines.push("[RECENT CONVERSATION]");
  recentMessages.forEach((m) => {
    lines.push(`${m.role.toUpperCase()}: ${m.content}`);
  });

  return {
    messages: recentMessages,
    ...(session.summary !== undefined ? { summary: session.summary } : {}),
    contextString: lines.join("\n"),
  };
}

/**
 * Get all sessions for a given user.
 */
export function getUserSessions(userId: string): ShortTermMemory[] {
  ensureDir();
  const files = fs.readdirSync(STORAGE_DIR).filter((f) => f.endsWith(".json"));
  const sessions: ShortTermMemory[] = [];
  for (const file of files) {
    try {
      const session = JSON.parse(
        fs.readFileSync(path.join(STORAGE_DIR, file), "utf-8")
      ) as ShortTermMemory;
      if (session.userId === userId) {
        sessions.push(session);
      }
    } catch {
      // skip corrupt
    }
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete a session from memory.
 */
export function deleteSession(sessionId: string): boolean {
  const p = sessionPath(sessionId);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

/**
 * Update working context (dynamic facts injected mid-session).
 */
export function setWorkingContext(sessionId: string, context: string): void {
  const session = readSession(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  session.workingContext = context;
  session.updatedAt = Date.now();
  writeSession(session);
}

/**
 * Stats for a user's short-term memory.
 */
export function getShortTermStats(userId: string) {
  const sessions = getUserSessions(userId);
  const totalMessages = sessions.reduce(
    (acc, s) => acc + s.messages.length,
    0
  );
  return {
    totalSessions: sessions.length,
    totalMessages,
    avgMessagesPerSession:
      sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0,
  };
}
