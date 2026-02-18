import {
  GoogleGenAI,
  createUserContent,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function geminiClient(prompt: string) {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [createUserContent(prompt)],
    });

    return result;
}

export function parseResult(result: any): any {
  const responseText = result.response?.text?.() || "";

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
    if (!jsonMatch) throw new Error("No valid JSON found in AI response");

    return JSON.parse(jsonMatch[0]);
  }
}

