import { ChromaClient } from "chromadb";

// run it: chroma run --host localhost --port 8000
export const chroma = new ChromaClient({
  path: "http://localhost:8000", 
});

export const collectionName = "uploaded-files";

