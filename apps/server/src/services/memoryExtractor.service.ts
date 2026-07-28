import { geminiClient, getText } from "../utils/index.js";
import type {
  ExtractedEntities,
  KGNodeType,
  KGEdgeType,
  ShortTermMessage,
} from "../types/memory.types.js";

const EXTRACTION_PROMPT = (conversation: string) => `
You are a memory extraction agent for an AI assistant. Your task is to extract structured knowledge from the given conversation.

Extract:
1. **Entities**: Named things (people, projects, concepts, skills, goals, preferences)
2. **Relations**: Connections between entities
3. **Facts**: Subject-predicate-object triples
4. **Summary**: A 1-sentence factual summary of what happened

ENTITY TYPES (use these exactly):
Person, Agent, Project, Concept, Skill, Goal, Event, Preference, Belief, Document, Organization, Location, Topic

EDGE TYPES (use these exactly):
INTERESTED_IN, LIKES, DISLIKES, WORKS_ON, KNOWS, HAS_SKILL, HAS_GOAL, EXPERIENCED, BELIEVES, RELATED_TO, MENTIONED_IN, DEPENDS_ON, CREATED_BY, PART_OF, CONTRADICTS, LEADS_TO, SIMILAR_TO

CONVERSATION:
${conversation}

Return ONLY a valid JSON object with this exact structure:
{
  "entities": [
    {
      "label": "entity name",
      "type": "Person|Concept|...",
      "properties": { "key": "value" }
    }
  ],
  "relations": [
    {
      "from": "entity label",
      "to": "entity label",
      "type": "EDGE_TYPE",
      "confidence": 0.9
    }
  ],
  "facts": [
    {
      "subject": "...",
      "predicate": "...",
      "object": "...",
      "confidence": 0.9
    }
  ],
  "summary": "One sentence summary of what was discussed"
}

Rules:
- Only extract concrete, stable facts (not trivial pleasantries)
- Focus on preferences, goals, skills, projects, beliefs
- Confidence 0.0-1.0 based on how explicit the statement was
- Return empty arrays if nothing significant found
- ONLY return JSON, no other text
`;

// ─── Extraction Function ──────────────────────────────────────────────────────
export async function extractMemoryFromConversation(
  messages: ShortTermMessage[],
  userId?: string
): Promise<ExtractedEntities> {
  const empty: ExtractedEntities = {
    entities: [],
    relations: [],
    facts: [],
    summary: "",
  };

  if (!messages || messages.length === 0) return empty;

  // Build transcript
  const transcript = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  if (transcript.trim().length < 30) return empty;

  try {
    const prompt = EXTRACTION_PROMPT(transcript);
    const result = await geminiClient(prompt);
    const text = getText(result);

    // Parse JSON from response
    let parsed: ExtractedEntities | null = null;
    try {
      const cleaned = text
        .trim()
        .replace(/^```json/i, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();
      parsed = JSON.parse(cleaned) as ExtractedEntities;
    } catch {
      // Try regex extraction
      const jsonMatch = text.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]) as ExtractedEntities;
        } catch {
          return empty;
        }
      } else {
        return empty;
      }
    }

    // Validate and sanitise
    return {
      entities: (parsed?.entities || []).map((e) => ({
        label: e.label || "",
        type: (e.type as KGNodeType) || "Concept",
        properties: e.properties || {},
      })),
      relations: (parsed?.relations || []).map((r) => ({
        from: r.from || "",
        to: r.to || "",
        type: (r.type as KGEdgeType) || "RELATED_TO",
        confidence: Math.min(1, Math.max(0, r.confidence ?? 0.7)),
      })),
      facts: (parsed?.facts || []).map((f) => ({
        subject: f.subject || "",
        predicate: f.predicate || "",
        object: f.object || "",
        confidence: Math.min(1, Math.max(0, f.confidence ?? 0.7)),
        source: "",
      })),
      summary: parsed?.summary || "",
    };
  } catch (err: any) {
    console.error("[MemoryExtractor] Extraction failed:", err.message);
    return empty;
  }
}

export async function extractFromSingleMessage(
  content: string
): Promise<{ summary: string; tags: string[]; importance: number }> {
  const prompt = `
Given this message, return a JSON object with:
- "summary": one-line summary (max 100 chars)
- "tags": array of 1-5 topic tags (e.g., ["finance", "investing"])
- "importance": 0.0-1.0 score (1.0 = very important fact, 0.0 = casual)

Message: "${content.slice(0, 500)}"

Return ONLY this JSON:
{
  "summary": "...",
  "tags": ["..."],
  "importance": 0.5
}
`;

  try {
    const result = await geminiClient(prompt);
    const text = getText(result)
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();
    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary || content.slice(0, 100),
      tags: parsed.tags || [],
      importance: Math.min(1, Math.max(0, parsed.importance ?? 0.5)),
    };
  } catch {
    return {
      summary: content.slice(0, 100),
      tags: [],
      importance: 0.3,
    };
  }
}
