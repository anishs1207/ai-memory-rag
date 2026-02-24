import fs from "fs";
import path from "path";

import BetterSqlite3 from "better-sqlite3";

export interface Embedding {
  content: string;
  vector: number[];
  metadata: { name: string };
}

export interface EmbeddingContext {
  name: string;
  description: string;
}

export class VectorStore {
  embeddings: Embedding[] = [];
   private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
    // @@see laert:this.baseDir = path.resolve(process.cwd(), "../../legal-vetor-db");
    this.loadAllEmbeddings();
  }

  private logHeader(title: string) {
    console.log("\n" + "═".repeat(80));
    console.log("🔍 " + title);
    console.log("═".repeat(80) + "\n");
  }

  private inspectDatabase(dbPath: string) {
    console.log(`\n🔍 Inspecting DB: ${dbPath}`);
    const db = new BetterSqlite3(dbPath, { readonly: true });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table';")
      .all()
      .map((t: any) => t.name);

    console.log("📋 Tables:", tables);
    db.close();
  }

  private loadAllEmbeddings() {
    this.logHeader("🚀 Loading All Embeddings (Full Content)");

    const baseDir = this.baseDir;

    if (!fs.existsSync(baseDir)) {
      console.log(`⚠️ Base directory not found: ${baseDir}`);
      return;
    }

    const folders = fs.readdirSync(baseDir);
    console.log(`📁 Found ${folders.length} folders under ${baseDir}`);

    for (const folder of folders) {
      const folderPath = path.join(baseDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const dbPath = path.join(folderPath, "chroma.sqlite3");
      if (!fs.existsSync(dbPath)) continue;

      try {
        this.inspectDatabase(dbPath);

        const db = new BetterSqlite3(dbPath, { readonly: true });

        if (
          !db
            .prepare("SELECT name FROM sqlite_master WHERE type='table';")
            .all()
            .map((t: any) => t.name)
            .includes("embeddings_queue")
        ) {
          db.close();
          continue;
        }


        interface EmbeddingRow { metadata: string; vector: Buffer; }
        const rows = db
          .prepare(`SELECT metadata, vector FROM embeddings_queue`)
          .all() as EmbeddingRow[];

        for (const row of rows) {
          try {
            const metadata = JSON.parse(row.metadata);
            const vectorBuffer = row.vector as Buffer;

            const floatArray = Array.from(
              new Float32Array(
                vectorBuffer.buffer,
                vectorBuffer.byteOffset,
                vectorBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
              ),
            );

            this.embeddings.push({
              content: metadata["chroma:document"] || "",
              vector: floatArray,
              metadata: { name: metadata["name"] || path.basename(folderPath) },
            });
          } catch {
            console.log("error")
          }
        }

        db.close();
      } catch (err: any) {
        console.log(`💥 Error reading DB ${folderPath}:`, err.message);
      }
    }

    console.log(`\n🎯 Total embeddings loaded: ${this.embeddings.length}`);
  }

  // ✅ Return all embeddings
  public async getAllEmbeddings(): Promise<Embedding[]> {
    return this.embeddings;
  }
}

const TOP_K = 15;

export const generateLegalPrompt = (
  userPrompt: string,
  embeddingContexts: EmbeddingContext[],
) => {
  let contextString =
    "You are a highly skilled AI Legal Assistant trained in Indian and International law.\n" +
    "You specialize in analyzing legal documents, summarizing judgments, explaining acts, and offering compliance or drafting guidance.\n\n" +
    "You have access to the following legal knowledge sources:\n\n";

  embeddingContexts.forEach((embed) => {
    contextString += `- ${embed.name}: ${embed.description}\n`;
  });

  const bigPrompt = `
${contextString}

Your role and guidelines:
1. Carefully analyze the user's question or uploaded content.
2. Use the above legal sources for reference, context, and support.
3. If a file (PDF, Word, Image) is uploaded, extract its text and use it as additional legal context.
4. Always reason within the boundaries of the law and provide factual, helpful, and clear responses.
5. Your tone must be professional, precise, and easy to understand.
6. **Always return your final output strictly in JSON format** as shown below.
7. Do not include any explanation or text outside the JSON object.
8. The JSON must contain:
   - **response** → your main answer or explanation.
   - **suggestions** → an array of 2–4 helpful follow-up prompts (like what the user might ask next).

---

### 💡 Example 1
**User Input:**
"What is the Indian Contract Act, 1872?"

**Expected JSON Output:**
{
  "response": "The Indian Contract Act, 1872 defines and regulates the formation and enforcement of contracts in India. It establishes rules for offer, acceptance, consideration, and breach, ensuring fair and legally enforceable agreements.",
  "suggestions": [
    "Tell me more about the key sections of this act",
    "Explain the difference between valid and void contracts",
    "Show examples of breach of contract cases"
  ]
}

---

### 💡 Example 2
**User Input:**
"Can you summarize the Consumer Protection Act, 2019?"

**Expected JSON Output:**
{
  "response": "The Consumer Protection Act, 2019 strengthens consumer rights and establishes mechanisms for grievance redressal. It introduces concepts like product liability, misleading advertisements, and e-commerce accountability.",
  "suggestions": [
    "Give me key differences between the 1986 and 2019 Acts",
    "Explain how consumer courts work under this Act",
    "Tell me more about product liability provisions"
  ]
}

---

### 💡 Example 3
**User Input:**
"Draft a simple NDA for a startup hiring a freelancer."

**Expected JSON Output:**
{
  "response": "Here’s a sample NDA:\n\nThis Non-Disclosure Agreement (NDA) is entered into between [Company Name] and [Freelancer Name] for protecting confidential information related to projects and intellectual property. Both parties agree not to disclose shared information without prior written consent.\n\nThis agreement is governed by Indian law.",
  "suggestions": [
    "Add a clause about data retention and deletion",
    "Explain what counts as confidential information",
    "Draft an NDA suitable for partnerships"
  ]
}

---

User's query:
"${userPrompt}"

Now, based on all the above examples, **generate only a JSON object** containing:
- "response": your best legal answer or explanation,
- "suggestions": an array of next-step prompt ideas related to the same topic.

Do not include any text, markdown, or commentary outside the JSON.
Remeber you are only allowed to give a JSON output.
`;

  return bigPrompt;
};

export const generateFinancePrompt = (
  userPrompt: string,
  embeddingContexts: EmbeddingContext[]
) => {
  let contextString = `
<agent>

  <about>
  You are a highly skilled AI Finance Assistant, acting as a personal CFO and financial coach.
  </about>

  <expertise>
    General Expertise includes:
    1. Personal finance management (expenses, budgets, savings) (add-expense & analyse-expense)
    2. Small business finance (revenue, expenses, cash flow, profit/loss)
    3. Investments (stocks, mutual funds, crypto)
    4. Tax planning and optimization
    5. Financial education and interactive guidance (general - Case-1)
  </expertise>
</agent>
`;

  embeddingContexts.forEach((embed) => {
    contextString += `- ${embed.name}: ${embed.description}\n`;
  });

  const bigPrompt = `
${contextString}

<roles-and-guidelines>
  1. Carefully analyze the user's question and any uploaded content.
  2. Extract and use text/data from any uploaded file (PDF, Word, Excel, Image) to inform your analysis.
  3. Provide actionable insights, advice, and reports on personal or business finances.
  4. Help users track expenses, categorize spending, suggest budgets, forecast cash flows, and plan savings or investments.
  5. Present your response in **Markdown format** whenever possible (tables, lists, charts, textual visualizations) inside the "response" field.
  6. Suggest concrete next steps the user can take to improve financial health or reach goals.
  7. Always reason based on data and financial principles.
  8. Your tone should be professional, precise, educational, and friendly.
  9. **Always return your final output strictly in JSON format**, as shown below.
  10. JSON must include:
    - **response** → your main financial answer in Markdown format
    - **suggestions** → an array of 2–4 helpful follow-up prompts the user might ask next
</roles-and-guidelines>

<output-format>
  <case-1>
    <when-to-use>
      1. when the query required is a general task here only give response & suggestions
      2. never use this if the user query requires even a slight usage of the specialised tools 
    </when-to-use>

    <examaple>
      '''json
      {
        "response": "### Smart Retirement Saving Strategy\\n\\n1. Start with an emergency fund of 6 months.\\n2. Allocate 15% of income to mutual funds or NPS.\\n3. Use SIPs for compounding over 10+ years.",
        "suggestions": [
          "Show projected returns if I invest ₹10,000 monthly",
          "Compare NPS and ELSS for long-term investing",
          "Explain tax benefits for retirement plans"
        ]
      }
    </examaple>
  </case-1>

  <case-2>
    <when-to-use>
      1. when the query is a specialised task of following: 
      2. "add-expense" or "analyse-expense" or "bussiness-analysis" or "asset-management "
      3. then only render "task" property in json object returned
      4. ALWAYS use this format one for EXPENSE REALTED STUFF
     </when-to-use>
    
    <example>
      '''json
      {
      "task": "add-expense"
      }
      '''
    </example>
  </case-2>
</output-format>

<examples>

  <example-1>
  User Input: "Tell me how to plan my retirement"

  '''json
  {
    "response": "### Smart Retirement Saving Strategy\\n\\n1. Start with an emergency fund of 6 months.\\n2. Allocate 15% of income to mutual funds or NPS.\\n3. Use SIPs for compounding over 10+ years.",
    "suggestions": [
      "Show projected returns if I invest ₹10,000 monthly",
      "Compare NPS and ELSS for long-term investing",
      "Explain tax benefits for retirement plans"
    ]
  }
  '''
  </example-1>

  <example-2>
  User Input: "Help me plan investments using my uploaded portfolio Excel."

  '''json
  {
  "task": "add-expense"
  }
  '''
  </example-2>

  <example-3>
  User Input: "Analyze my uploaded business revenue and expense report."

  '''json
  {
    "task": "bussiness-analysis"
  }
  '''
  </example-3>

  <example-4>
  User Input: "Add my recent grocery purchase of ₹2,350 to expenses."

  '''json
  {
    "task": "add-expense"
  }
  '''
  </example-4>

  <example-5>
  User Input: "Analyze my spending trends from the last 3 months and show key insights."

  '''json
  {
    "task": "analyse-expense"
  }
  '''
  </example-5>

  <example-6>
  User Input: "Help me diversify my assets between fixed deposits and mutual funds."

  '''json
  {
    "task": "asset-management"
  }
  '''
  </example-6>

  <example-7>
  User Input: "How can I reduce my tax liability this financial year?"

  '''json
  {
    "response": "### Tax Optimization Plan\\n\\n1. Max out Section 80C investments (₹1.5 lakh).\\n2. Use NPS Tier-I for additional ₹50,000 deduction under 80CCD(1B).\\n3. Switch to tax-efficient mutual funds.\\n4. Claim HRA and health insurance deductions where applicable.",
    "suggestions": [
      "Calculate total tax savings based on my current income",
      "Show difference between old and new tax regimes",
      "Suggest low-risk tax-saving investments"
    ]
  }
  '''
  </example-7>

  <example-8>
  User Input: "Set a budget plan for my monthly income of ₹70,000."

  '''json
  {
    "response": "### Recommended Monthly Budget (₹70,000 Income)\\n\\n| Category | Allocation |\\n|-----------|-------------|\\n| Rent | ₹18,000 |\\n| Food | ₹10,000 |\\n| Utilities | ₹4,000 |\\n| Savings | ₹10,000 |\\n| Investments | ₹8,000 |\\n| Miscellaneous | ₹20,000 |\\n\\n**Goal:** Maintain 15% savings and review every 2 months.",
    "suggestions": [
      "Forecast my savings growth for next 6 months",
      "Add a spending tracker for daily expenses",
      "Suggest apps or tools to monitor my budget"
    ]
  }
  '''
  </example-8>

  <example-9>
  User Input: "Track my EMI payments and show how they affect my monthly cash flow."

  '''json
  {
    "response": "### EMI Cash Flow Overview\\n\\n| Loan Type | EMI (₹) | Tenure |\\n|------------|----------|---------|\\n| Home Loan | 25,000 | 15 years |\\n| Car Loan | 10,000 | 5 years |\\n| Personal Loan | 5,000 | 2 years |\\n\\n**Total Monthly EMI:** ₹40,000\\n\\n**Observation:** 57% of income goes into EMIs.\\n**Suggestion:** Consider refinancing or early repayment options.",
    "suggestions": [
      "Estimate interest savings if I prepay my car loan",
      "Show timeline to become debt-free",
      "Compare EMI-to-income ratio with recommended limits"
    ]
  }
  '''
  </example-9>

</examples>

<user-query>
  User's query: ${userPrompt}
</user-query>

<important>
  Do not include any text, markdown, or commentary outside the JSON.
</important>

`;

  return bigPrompt;
};

export const runRAG = async (query: string, baseDir: string): Promise<EmbeddingContext[]> => {
  const vectorStore = new VectorStore(baseDir);
  const embeddings: Embedding[] = await vectorStore.getAllEmbeddings();

  const allContexts: EmbeddingContext[] = embeddings.map((e) => ({
    name: e.metadata.name,
    description: e.content,
  }));

  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return allContexts.slice(0, TOP_K); // return top-K if no query

  const queryWords = lowerQuery.split(/\s+/);

  const scored = allContexts
    .map((ctx) => {
      let score = 0;
// +2 if query appears in name
      if (ctx.name.toLowerCase().includes(lowerQuery)) score += 2;
      // +1 for each word match in description
      const descLower = ctx.description.toLowerCase();
      queryWords.forEach((word) => {
        if (descLower.includes(word)) score += 1;
      });

      return { ...ctx, score };
    })
    .filter((ctx) => ctx.score > 0)
    .sort((a, b) => b.score - a.score);

    // Return top-K matches only

  return scored.slice(0, TOP_K);
};

// Self-test (not required but see it)
// if (require.main === module) {
//   const store = new VectorStore();
//   console.log("✅ Example Embedding (full content):", store.embeddings[0]);
// }
