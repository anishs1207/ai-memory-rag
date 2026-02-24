import {
  GoogleGenAI,
  createUserContent,
} from "@google/genai";

export async function geminiClient(prompt: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [createUserContent(prompt)],
    });

    return result;
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
        // If not JSON but we expected it, maybe just return the text as a fallback if suitable, 
        // but parseResult is usually used when JSON is expected.
        return { text: responseText }; 
    }

    return JSON.parse(jsonMatch[0]);
  }
}

