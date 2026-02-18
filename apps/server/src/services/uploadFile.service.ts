import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { randomUUID } from "crypto";
import { chroma, collectionName } from "@/lib/chroma.js"; 
import { embedText } from "@/lib/embedding.js";

// Helper to read text content from file
async function readFileContent(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    return data.text;
  } else {
    return fs.readFileSync(filePath, "utf-8");
  }
}

// Helper to split text into chunks for embeddings
function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

// Main upload function
export const uploadFile = async (filePath: string) => {
  const content = await readFileContent(filePath);
  const chunks = chunkText(content);

  // Get or create the collection
  const collection = await chroma.getOrCreateCollection({
    name: collectionName,
  });

  for (let i = 0; i < chunks.length; i++) {
    //@ts-expect-error
    const embedding = await embedText(chunks[i]);

    await collection.add({
      ids: [randomUUID()],
      embeddings: [embedding],
      //@ts-expect-error
      documents: [chunks[i]],
      metadatas: [
        {
          source: path.basename(filePath),
          chunkIndex: i,
        },
      ],
    });
  }

  console.log(`✅ Uploaded ${chunks.length} chunks from ${filePath}`);
};
