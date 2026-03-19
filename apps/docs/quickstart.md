# 🏁 Quickstart & API Setup

Learn how to get the Memory Framework up and running locally quickly. 

## Requirements
Ensure you are using:
- **Node.js 18+**
- **npm 10+**
- An active Google Cloud Project with the `Gemini API` enabled.
- Neo4j and Pinecone instances (or a local Docker Neo4j bolt connection).

## Installation

1. Clone the master repository and drop into the directory:
```bash
git clone https://github.com/anishs1207/ai-memory-rag
cd ai-memory-rag
```

2. Install turbo dependencies:
```bash
npm install
```

3. Generate a `.env` in the root of your project:
```env
GEMINI_API_KEY=your_api_key_here
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

## Running the Architecture

Because this is a multiproduct Turborepo, launching the services is handled concurrently from the root directory via standard workspaces.

```bash
npm run dev
```

This starts:
1. The **NestJS Backend API** accessible at `localhost:3001` or your configured port.
2. The **Next.js Frontend UI** accessible at `localhost:3000`.

## Working with the Application
Once both servers are running, access the web UI. 

Navigate to the **`/memory`** page within your app structure.
- Try interacting with the chat! Provide context about an identity ("I am a developer who loves Next.js").
- As conversational bounds expire, watch the `Knowledge Graph` tab visualize mapping your name to the concept `Next.js`!
- The API transparently connects Node bindings through the `/kg/node` endpoints.
