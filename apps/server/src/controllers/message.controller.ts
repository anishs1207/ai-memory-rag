import type { Request, Response } from "express";
import {runRAG, generateLegalPrompt, generateFinancePrompt} from "@/services/rag.service.js";
import { geminiClient, parseResult, getText } from "@/utils/index.js";
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { randomUUID } from "crypto";
import { Pinecone } from "@pinecone-database/pinecone";
import { embedText } from "@/lib/embedding.js";
import LandingAIADE from "landingai-ade";

interface EmbeddingContext {
  name: string;
  description: string;
}

// also use of tersac for adding files (context added for it)
// add document ocr for it + make it work here:
//@ test should work here but
const ChatLegal = async(req: Request, res: Response) => {
    try {
        const {prompt} = req.body;

    if (!prompt) {
        return res.status(400).json({
            success: false,
            error: "Prompt is not given"
        })
    }

    const embeddingContexts: EmbeddingContext[] = await runRAG(prompt, "./legal-vector-db");

    console.log("context:", embeddingContexts);

    const bigPrompt = generateLegalPrompt(prompt, embeddingContexts);
    
    const aiResponse = await geminiClient(bigPrompt);

    if (!aiResponse) {
        return res.status(400).json({
            success: false,
            error: "AI Response is not given"
        })
    }

    const result = parseResult(aiResponse);
    const responseText = typeof result === 'string' ? result : (result.response || JSON.stringify(result));

    return res.status(200).json({
        success: true,
        data: responseText
    })

    } catch(err: any) {
        console.error("ChatLegal Error:", err)
        return res.status(500).json({
            success: false,
            error: err.message || "Internal Server Error"
        })
    }
    
}

const ChatFinance = async(req: Request, res: Response) => {
    try {
        const {prompt} = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: "Prompt is not given"
            })
        }

        const embeddingContexts: EmbeddingContext[] = await runRAG(prompt, "./finance-vector-db");

        console.log("context:", embeddingContexts);

        const bigPrompt = generateFinancePrompt(prompt, embeddingContexts);
        
        const aiResponse = await geminiClient(bigPrompt);

        if (!aiResponse) {
            return res.status(400).json({
                success: false,
                error: "AI Response is not given"
            })
        }

        const result = parseResult(aiResponse);
        const responseText = typeof result === 'string' ? result : (result.response || JSON.stringify(result));

        return res.status(200).json({
            success: true,
            data: responseText
        })
       
    } catch(err: any) {
        console.error("ChatFinance Error:", err)
        return res.status(500).json({
            success: false,
            error: err.message || "Internal Server Error"
        })
    }
}

const ChatGeneral = async(req: Request, res: Response) => {
    try {
        const {prompt} = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                error: "Prompt is not given"
            })
        }

        const bigPrompt = `
          <agent>
          You are a helpful general assistant. Answer clearly and concisely.
          </agent>

          user asked:
          ${prompt}
        `
        const aiResponse = await geminiClient(bigPrompt);

        console.log("apiResponse", aiResponse);

        if (!aiResponse) {
            return res.status(400).json({
                success: false,
                error: "Error getting response"
            })
        }

        const responseText = getText(aiResponse);

        console.log("responseText", responseText);

        return res.status(200).json({
            success: true,
            data: responseText
        })

    } catch(err: any) {
        console.error("ChatGeneral Error:", err)
        return res.status(500).json({
            success: false,
            error: err.message || "Internal Server Error"
        })
    }
}

// refer: https://app.pinecone.io/organizations/-OkIhbKdrSTCm9S_ivLE/projects/8d67056d-52d7-414d-b0c6-5a8d155d0840/keys
// Lazy singleton: instantiated on first use so dotenv has already run
let _pinecone: Pinecone | null = null;
function getPinecone(): Pinecone {
  if (!_pinecone) {
    _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return _pinecone;
}

const INDEX_NAME = "documents";

async function readFileContent(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  } else {
    return fs.readFileSync(filePath, "utf-8");
  }
}

function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function uploadFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "File is required" });
      }

      const filePath = req.file.path;
      const fileName = req.file.originalname;

      const content = await readFileContent(filePath);
      const chunks = chunkText(content);

      const index = getPinecone().index(INDEX_NAME);

      for (let i = 0; i < chunks.length; i++) {
        const textToEmbed = chunks[i] || "";
        const vector = await embedText(textToEmbed);

        await index.upsert([
          {
            id: randomUUID(),
            values: vector,
            metadata: {
              fileName: fileName as string,
              chunkIndex: i,
              text: textToEmbed,
            },
          },
        ]);
      }

      // Optional: delete uploaded file after processing
      fs.unlinkSync(filePath);

      // Track uploaded file
      const filesPath = path.join(process.cwd(), "uploads", "files.json");
      let files = [];
      if (fs.existsSync(filesPath)) {
        files = JSON.parse(fs.readFileSync(filesPath, "utf-8"));
      }
      if (!files.includes(fileName)) {
        files.push(fileName);
        fs.writeFileSync(filesPath, JSON.stringify(files, null, 2));
      }

      return res.status(200).json({
        success: true,
        message: `File "${fileName}" uploaded and indexed successfully!`,
        chunksIndexed: chunks.length,
      });
    } catch (err: any) {
      console.error("Error uploading file:", err);
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ success: false, error: err.message });
    }
}

type RAGResult = {
  answer: string;
  sources: {
    fileName: string;
    chunkIndex: number;
    score?: number;
  }[];
};

// query a file (based on its name) & query rag on it
// uploaded a file and use varipus rag techniques based on it
// or combine with to have a toggle for leagl mode or not & add here
// make rag work here and also allow tool to be called here
// apply rag on it (b)
const queryMessageFromFile = async (
  req: Request,
  res: Response
) => {
  try {
    const { fileName, prompt, topK = 5, legalMode = false } = req.body;

    if (!fileName || !prompt) {
      return res.status(400).json({
        success: false,
        error: "fileName and prompt are required",
      });
    }

    // 1️⃣ Embed query
    const queryEmbedding = await embedText(prompt);

    // 2️⃣ Query Pinecone with file filter
    const index = getPinecone().index(INDEX_NAME);

    const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter: {
          fileName: { $eq: fileName },
        },
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          answer: "No relevant information found in this document.",
          sources: [],
        } satisfies RAGResult,
      });
    }

    // 3️⃣ Build context
    const context = queryResponse.matches
      .map((match, i) => {
        return `Chunk ${i + 1}:\n${match.metadata?.text ?? ""}`;
      })
      .join("\n\n");

    // 4️⃣ System prompt
    const systemPrompt = legalMode
            ? `You are a legal assistant. Answer strictly using the provided document context.
        If the answer is not present, say "The document does not contain this information."`
            : `You are a helpful assistant. Use the provided context to answer the question.`;

            const finalPrompt = `
        ${systemPrompt}

        DOCUMENT CONTEXT:
        ${context}

        USER QUESTION:
        ${prompt}

        ANSWER:
`;

    // 5️⃣ Call Gemini
    const aiResponse = await geminiClient(finalPrompt);
    const answer = getText(aiResponse);

    // 6️⃣ Response
    const result: RAGResult = {
      answer,
      //@ts-expect-error
      sources: queryResponse.matches.map((m) => ({
        fileName: m.metadata?.fileName as string,
        chunkIndex: m.metadata?.chunkIndex as number,
        score: m.score,
      })),
    };

    return res.status(200).json({
      success: true,
      data: answer,
    });
  } catch (err: any) {
    console.error("RAG query error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to query document",
    });
  }
};

// const client = new LandingAIADE({
//   apikey: process.env.VISION_AGENT_API_KEY
// });

// 3 stages (parse) => Document → Parse → Split → Extract → Structured data
// const parseDocument = async(req: Request, res: Response) => {
//   const {filePath, type} = req.body;

//   // type => use of terrasct and ade and paddleOCR here

//   if (!filePath) {
//     return res.status(400).json({
//       success: false,
//       error: "filePath is required",
//     });
//   }

//   const response = await client.parse({
//     // file path can be local file or remote
//     document: fs.createReadStream(filePath),
//     model: "dpt-2-latest"
//  });


 
// // her: https://docs.landing.ai/ade/ade-typescript
// // Parse a remote file
// const response2 = await client.parse({
//   // for remote file path url taken here
//   document: await fetch("https://example.com/document.pdf"),
//   model: "dpt-2-latest",
//   split: "page",
// });

 
// console.log(response.chunks);

// // Save Markdown output (useful if you plan to run extract on the Markdown)
// // https://docs.landing.ai/api-reference/tools/ade-split (the API docs here)
// fs.writeFileSync("output.md", response.markdown, "utf-8");


// console.log(response2.chunks);


// // Save Markdown output (useful if you plan to run extract on the Markdown)
// fs.writeFileSync("output2.md", response.markdown, "utf-8");




//   return res.status(200).json({
//     success: true,
//     data: response,
//   });
// }

// const parseManyDocuments = async(req: Request, res: Response) => {
//   try {
//     const job = await client.parseJobs.create({
//   document: fs.createReadStream("/path/to/file/document"),
//   model: "dpt-2-latest"
// });

// const jobId = job.job_id;
// console.log(`Job ${jobId} created.`);

// // Step 2: Get the parsing results
// while (true) {
//   const response = await client.parseJobs.get(jobId);
//   if (response.status === "completed") {
//     console.log(`Job ${jobId} completed.`);
//     break;
//   }
//   console.log(`Job ${jobId}: ${response.status} (${(response.progress * 100).toFixed(0)}% complete)`);
//   await new Promise(resolve => setTimeout(resolve, 5000));
// }

// // Step 3: Access the parsed data
// const response3 = await client.parseJobs.get(jobId);
// //@ts-expect-error
// console.log("Global Markdown:", response3.data.markdown.substring(0, 200) + "...");
// //@ts-expect-error
// console.log(`Number of chunks: ${response3.data.chunks.length}`);

// //@ts-expect-error
// // Save Markdown output (useful if you plan to run extract on the Markdown)
// fs.writeFileSync("output.md", response3.data.markdown, "utf-8");

// // List all jobs
// const response = await client.parseJobs.list();
// for (const job of response.jobs) {
//   console.log(`Job ${job.job_id}: ${job.status}`);
// }

// // works with parse presponse dtaa;
// //@ts-expect-error
// for (const chunk of response.chunks) {
//   if (chunk.type === 'text') {
//     console.log(`Chunk ${chunk.id}: ${chunk.markdown}`);
//   }
// }

// // Filter chunks by page:
// //@ts-expect-error
// const page0Chunks = response.chunks.filter(chunk => chunk.grounding.page === 0);
// console.log(page0Chunks);
// // Get chunk locations:
// //@ts-expect-error
// for (const chunk of response.chunks) {
//   const box = chunk.grounding.box;
//   console.log(`Chunk at page ${chunk.grounding.page}: (${box.left}, ${box.top}, ${box.right}, ${box.bottom})`);
// }
// // Identify the chunk type for each chunk:
// //@ts-expect-error
// for (const [chunkId, grounding] of Object.entries(response.grounding)) {
//   //@ts-expect-error
//   console.log(`Chunk ${chunkId} has type: ${grounding.type}`);
// }

//   } catch(err) {

//   }
// }

async function getFiles(req: Request, res: Response) {
    try {
        const index = getPinecone().index(INDEX_NAME);
        // This is a hack because Pinecone doesn't support listing unique metadata values easily.
        // We'll just return a message or implement a better tracker if needed.
        // For now, let's assume we maintain a simple local list.
        const filesPath = path.join(process.cwd(), "uploads", "files.json");
        let files = [];
        if (fs.existsSync(filesPath)) {
            files = JSON.parse(fs.readFileSync(filesPath, "utf-8"));
        }
        return res.status(200).json({ success: true, data: files });
    } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

export {ChatFinance, ChatLegal, ChatGeneral, queryMessageFromFile, uploadFile, getFiles};

// In Landing AI’s Agentic Document Extraction (Agent Document Extraction), Parse, Extract, and Split are three different stages/operations in the document understanding pipeline. They sound similar, but they solve different problems.

// Here’s a clear mental model, then a side-by-side breakdown, and finally when to use what.

// Big picture (one-line intuition)

// Parse → Turn a document into machine-readable structure

// Split → Break the document into smaller logical pieces

// Extract → Pull specific information you care about

// Think of it as:

// Document → Parse → Split → Extract → Structured data

// 1️⃣ Parse
// What it does

// Parse converts a raw document into a structured representation.

// It understands:

// Text

// Layout (pages, blocks, tables)

// Reading order

// Bounding boxes

// Basic document structure

// Input

// PDF

// Scanned image

// DOCX, etc.

// Output

// A structured document object (text + layout + metadata)

// Example

// PDF:

// Invoice #123
// Total: $4,500
// Date: 12/01/2025


// After Parse, the system knows:

// This is text (not an image)

// “Invoice #123” is a header

// “Total: $4,500” is a key-value style line

// Where each text block appears on the page

// ⚠️ Parse does NOT decide what information is important.

// 2️⃣ Split
// What it does

// Split divides a parsed document into smaller, logical chunks.

// Useful for:

// Multi-page documents

// Multiple records in one file

// Long contracts

// Batch invoices

// Common split strategies

// By page

// By section heading

// By table row

// By document boundary (multiple invoices in one PDF)

// Example

// One PDF contains:

// Invoice A (pages 1–2)
// Invoice B (pages 3–4)
// Invoice C (pages 5–6)


// After Split:

// Chunk 1 → Invoice A
// Chunk 2 → Invoice B
// Chunk 3 → Invoice C


// Each chunk can now be processed independently.

// ⚠️ Split does not extract data — it just groups content.

// 3️⃣ Extract
// What it does

// Extract pulls specific fields from parsed (and usually split) content.

// This is where business meaning happens.

// Input

// Parsed document (or a split chunk)

// Output

// Structured fields (JSON)

// Example extraction schema
// {
//   "invoice_number": "string",
//   "invoice_date": "date",
//   "total_amount": "number",
//   "vendor_name": "string"
// }

// Result
// {
//   "invoice_number": "123",
//   "invoice_date": "2025-01-12",
//   "total_amount": 4500,
//   "vendor_name": "ABC Pvt Ltd"
// }


// This step uses:

// LLM reasoning

// Layout awareness

// Pattern recognition

// Side-by-side comparison
// Step	Purpose	Changes document size?	Adds meaning?
// Parse	Make document readable & structured	❌ No	❌ No
// Split	Break document into chunks	✅ Yes	❌ No
// Extract	Pull required information	❌ No	✅ Yes
// Typical real-world pipeline
// Example: Invoice processing system

// Parse

// OCR + layout understanding

// Split

// Separate multiple invoices in one PDF

// Extract

// Invoice number

// Vendor

// Date

// Total

// Line items

// When to use what (quick rules)

// ✅ Always use Parse → it’s the foundation

// ✅ Use Split if:

// Document is long

// Multiple records exist

// You want better accuracy / parallel processing

// ✅ Use Extract when:

// You need structured output for databases / APIs

// One-sentence analogy

// Parse = Reading the book

// Split = Bookmarking chapters

// Extract = Writing notes with key facts

// If you want, I can:

// Map this to Landing AI UI steps

// Compare it with Azure Form Recognizer / Google DocAI

// Show a real JSON pipeline example

// Explain how agents decide when to split automatically

// Just tell me 👍