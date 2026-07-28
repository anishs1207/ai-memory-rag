import { Worker } from "bullmq";
import { connection } from "../lib/queue.js";
import { readFileContent, chunkText, getPinecone, INDEX_NAME } from "../controllers/message.controller.js";
import { embedText } from "@/lib/embedding.js";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

export const documentWorker = new Worker(
  "document-indexing",
  async (job) => {
    const { filePath, fileName } = job.data;
    console.log(`[DocumentWorker] Processing job ${job.id} for file: ${fileName}`);

    try {
      const content = await readFileContent(filePath);
      const chunks = chunkText(content);
      const totalChunks = chunks.length;

      console.log(`[DocumentWorker] Splitted file into ${totalChunks} chunks.`);

      const index = getPinecone().index(INDEX_NAME);

      for (let i = 0; i < totalChunks; i++) {
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

        const progressPercentage = Math.round(((i + 1) / totalChunks) * 100);
        await job.updateProgress({
          processed: i + 1,
          total: totalChunks,
          percentage: progressPercentage,
        });
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filesPath = path.join(uploadsDir, "files.json");
      let files = [];
      if (fs.existsSync(filesPath)) {
        files = JSON.parse(fs.readFileSync(filesPath, "utf-8"));
      }
      if (!files.includes(fileName)) {
        files.push(fileName);
        fs.writeFileSync(filesPath, JSON.stringify(files, null, 2));
      }

      console.log(`[DocumentWorker] Successfully finished job ${job.id} for file: ${fileName}`);
      return { success: true, fileName };
    } catch (err: any) {
      console.error(`[DocumentWorker] Error in job ${job.id}:`, err);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
      throw err;
    }
  },
  { connection }
);

documentWorker.on("completed", (job) => {
  console.log(`[DocumentWorker] Job ${job?.id} completed successfully`);
});

documentWorker.on("failed", (job, err) => {
  console.error(`[DocumentWorker] Job ${job?.id} failed:`, err);
});
