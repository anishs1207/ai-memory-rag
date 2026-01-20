import dotenv from "dotenv"
import { GoogleGenerativeAI } from "@google/generative-ai";
import neo4j from "neo4j-driver";

dotenv.config({
    path: ".env"
})

if (!process.env.GEMINI_API_KEY) {
    console.log("isnide this")
    throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const gemini = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

export type MemoryFact = {
  subject: string;
  relation: string;
  object: string;
};

export async function extractLongTermMemory(
  conversation: string
): Promise<MemoryFact[]> {
  const prompt = `
You are a memory extraction system for an AI agent.

Extract ONLY long-term, stable facts about the user.
Ignore emotions, temporary states, questions, and requests.

Allowed relations:
- IS_A
- LOCATED_IN
- WORKING_ON
- INTERESTED_IN
- OWNS
- PREFERS

Return STRICT JSON ARRAY ONLY.

Example:
[
  { "subject": "Anish", "relation": "LOCATED_IN", "object": "India" }
]

Conversation:
${conversation}
`;

  const result = await gemini.generateContent(prompt);
  const text = result.response.text();

  const json = text.match(/\[.*\]/s);
  if (!json) return [];

  return JSON.parse(json[0]);
}

export const driver = neo4j.driver(
  "bolt://localhost:7687",
  neo4j.auth.basic("neo4j", "password")
);

export async function saveFacts(facts: {
  subject: string;
  relation: string;
  object: string;
}[]) {
  const session = driver.session();

  try {
    for (const fact of facts) {
      await session.run(
        `
        MERGE (s:Entity {name: $subject})
        MERGE (o:Entity {name: $object})
        MERGE (s)-[:${fact.relation}]->(o)
        `,
        {
          subject: fact.subject,
          object: fact.object,
        }
      );
    }
  } finally {
    await session.close();
  }
}


async function main() {
  const conversation = `
User: My name is Anish
User: I live in India
User: I'm building an AI agent using Gemini
User: I love startups and product building
`;

  const facts = await extractLongTermMemory(conversation);
  console.log("Extracted facts:", facts);

  await saveFacts(facts);
  console.log("Saved to knowledge graph");
}

main();
