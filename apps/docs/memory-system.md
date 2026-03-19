# Memory System (Deep Dive)

The real power behind the Memory Framework lies in how memory orchestrates data dynamically instead of manually relying on explicit user prompts. 

## Memory Orchestrator
The Memory Orchestrator is the heart of the system. Its primary role involves:
1. Intercepting user queries.
2. Fanning out parallel search commands to short-term context, long-term Pinecone vectors, and Neo4j relational paths.
3. Re-injecting the fused results directly into the Gemini LLM prompt to inform the response.

## Entity Extraction (Knowledge Graph)
Whenever working memory context bounds exceed limits or a new major topic is recognized, we fire an asynchronous pipeline.

### Steps
1. **Dialogue Evaluation:** Reviewing current chat against previous episodes.
2. **Extraction Prompt:** Asking Gemini to map Entities (Nodes) and Relations (Edges) out of the raw conversation buffer.
3. **Graph Upsert:** Merging these nodes into Neo4j. If a node exists (e.g. `Person: Anish`), it amplifies the confidence score and augments its frequency count rather than duplicating nodes.

## Interactive Memory Graph
The platform provides a Next.js `Canvas`-based Force-Directed visualization map.
- Colors denote variable categories (e.g. Person, Concept, Skill).
- Node Size directly represents statistical frequency tracking.
- Highlighted Edges display relational bindings.

This enables you to see precisely what the AI remembers at a fundamental atomic level.
