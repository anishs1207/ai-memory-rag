import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, createUserContent } from "@google/genai";

// Initialize Gemini client with key from process.env, sanitizing surrounding quotes if present
const rawApiKey = process.env.GEMINI_API_KEY || "";
const apiKey = (rawApiKey.startsWith('"') && rawApiKey.endsWith('"')) || (rawApiKey.startsWith("'") && rawApiKey.endsWith("'"))
  ? rawApiKey.slice(1, -1)
  : rawApiKey;
const ai = new GoogleGenAI({ apiKey });

export async function POST(request: NextRequest) {
  try {
    const { prompt, history = [] } = await request.json();


    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in .env file." },
        { status: 500 }
      );
    }

    // System instructions for generating premium interactive React components
    const systemInstruction = `You are a world-class frontend React engineer.
Your job is to generate a single self-contained React functional component named 'Component' using Tailwind CSS.

CRITICAL RULES:
1. Return ONLY the raw code. Do NOT wrap it in markdown block tags like \`\`\`tsx or \`\`\`. Do not write any introductory or explanatory text.
2. The component function name MUST be exactly 'Component'. Do NOT use default exports or named exports (no 'export default function Component' or 'export function Component'). Simply write:
   function Component() {
     ...
     return (
       ...
     );
   }
3. Use Tailwind CSS for styling. Prefer modern, premium, cohesive designs (e.g., dark modes, custom color palettes, glassmorphism, nice gradients).
4. Do NOT write import statements. React hooks (useState, useEffect, useMemo, useCallback, useRef) and React itself are already imported and in scope.
5. You can use any Lucide icons via the 'Lucide' namespace. For example, <Lucide.ArrowRight className="h-4 w-4" /> or <Lucide.Activity className="w-5 h-5 text-indigo-500" />. Do NOT import them.
6. You can use Recharts components for data visualizations, accessible via the 'Recharts' namespace (e.g., <Recharts.ResponsiveContainer>, <Recharts.AreaChart>, <Recharts.Area>, <Recharts.XAxis>, <Recharts.YAxis>, <Recharts.Tooltip>). Do NOT import them.
7. The component must be fully interactive with state transitions, mock data, and functional features. Add animations and modern interactive hover effects. Make it look state-of-the-art.
8. NEVER reference external images or APIs that require authentication. Use mock data or Lucide icons instead.
`;

    // Convert history and current prompt to the API format
    // Map history array [{role: 'user' | 'model', text: string}] to createUserContent format if necessary,
    // or pass them as contents array.
    const contents = [];

    // Add history
    for (const msg of history) {
      if (msg.role === "user") {
        contents.push(createUserContent(msg.text));
      } else if (msg.role === "model") {
        // Create model content
        contents.push({
          role: "model",
          parts: [{ text: msg.text }]
        });
      }
    }

    // Add current user prompt
    contents.push(createUserContent(prompt));

    // Call Gemini to generate the UI component
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.2, // low temperature for structured and accurate code gen
      }
    });

    const generatedText = response.text || "";

    // Log step as required by GEMINI.md
    console.log("[GEMINI_UI_GEN] Successfully generated React component using Gemini API");

    return NextResponse.json({ code: generatedText });
  } catch (error: any) {
    console.error("[GEMINI_UI_GEN_ERROR] Error generating UI component:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred while generating component." },
      { status: 500 }
    );
  }
}
