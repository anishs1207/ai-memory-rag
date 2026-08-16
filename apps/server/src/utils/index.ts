import { smollmClient } from "./smollm.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

// Rule 2: Add comments explaining important logic
export async function geminiClient(prompt: string, llm?: string) {
    if (llm === "smollm") {
        // Rule 3: Log each major step
        console.log("[LOG] Routing prompt to local SmolLM-135M model");
        return smollmClient(prompt, "smollm");
    }
    if (llm === "sf_financial_qa") {
        // Rule 3: Log each major step
        console.log("[LOG] Routing prompt to local sf_financial_qa model");
        return smollmClient(prompt, "sf_financial_qa");
    }
    if (llm === "dpo" || llm === "dpo_adapter") {
        // Rule 3: Log each major step
        console.log("[LOG] Routing prompt to local dpo_adapter model");
        // Route specifically to the DPO adapter on the Python server
        return smollmClient(prompt, "dpo_adapter");
    }
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing from apps/server/.env");

    const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
    console.log(`[LOG] Routing prompt to Anthropic Claude (${model})`);
    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
    });

    const payload = await response.json() as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      const error = new Error(payload.error?.message || `Claude request failed with status ${response.status}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    const responseText = payload.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("\n") || "";
    return { text: responseText };
}

export function getText(result: any): string {
  if (!result) return "";
  
  // Try text() function (standard SDK)
  if (typeof result.text === "function") {
    try {
      return result.text();
    } catch {}
  }
  
  // Try .text getter/property
  if (typeof result.text === "string") {
    return result.text;
  }

  // Handle result.response structure
  if (result.response) {
    if (typeof result.response.text === "function") {
      try {
        return result.response.text();
      } catch {}
    }
    if (typeof result.response.text === "string") {
      return result.response.text;
    }
  }

  // Fallback to candidates structure
  const candidates = result.candidates || result.response?.candidates;
  if (candidates?.[0]?.content?.parts?.[0]) {
    return candidates[0].content.parts[0].text || "";
  }

  return "";
}

export function parseResult(result: any): any {
  const responseText = getText(result);

  try {
     let cleaned = responseText
      .trim()
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "");

     const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    const jsonMatch = responseText.match(/(\[.*\]|\{.*\})/s);
    if (!jsonMatch) {
        return { text: responseText }; 
    }

    return JSON.parse(jsonMatch[0]);
  }
}

