import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function embedText(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error("Cannot embed empty text");
  }

  const result = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: [
      {
        role: "user",
        parts: [{ text }],
      },
    ],
  });

  const embedding = result.embeddings?.[0]?.values;

  if (!embedding) {
    throw new Error("Failed to generate embedding from Gemini");
  }

  return embedding;
}
