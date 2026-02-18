import { ChromaClient } from "chromadb";

export const chroma = new ChromaClient({
  path: "http://localhost:8000", // Chroma server URL
});

export const collectionName = "uploaded-files"; // default collection for uploaded files

// run it: chroma run --host localhost --port 8000
