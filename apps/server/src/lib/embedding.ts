import { GoogleGenAI } from "@google/genai";

export async function embedText(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error("Cannot embed empty text");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: [
      {
        parts: [{ text }],
      },
    ],
  });

  const embedding = (result as any).embeddings?.[0]?.values;

  if (!embedding) {
    throw new Error("Failed to generate embedding from Gemini");
  }

  return embedding;
}
