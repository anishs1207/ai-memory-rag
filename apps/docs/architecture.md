# 🏗️ Architecture

The Memory Framework implements a hierarchical memory structure inspired by human cognitive architecture.

## Overview
The platform connects a **NestJS** backend processing layer with a **Next.js** presentation layer, separated seamlessly over standard APIs. 

At the center is the Orchestrator Service, resolving parallel queries across three distinct layers.

## The Three Layers

### 1. Working Memory (Short-Term Context)
- **Role:** Keeps track of the immediate dialogue bounds.
- **Mechanism:** Sliding window algorithm evaluating token usage. Standard limits are commonly 20 conversational turns.
- **Behavior:** Once full, it triggers an *Autonomous Summarization* step, dropping out old context smoothly and saving it offline.

### 2. Semantic Memory (Long-Term Episodic)
- **Role:** Deep semantic retrieval for concepts and topics discussed in the past.
- **Database:** Powered by `Pinecone` for rapid vector search.
- **Model:** Embeddings are mapped using `Gemini 2.0 Flash`. Employs logarithmic memory decay and tracking over temporal access markers.

### 3. Knowledge Graph (Factual & Relational)
- **Role:** Explicit structural mapping of entities (people, concepts, ideas) and relationships.
- **Database:** Standard implementations target `Neo4j`.
- **Properties:** Graph edges are assigned *confidence weights*, creating probabilistic reasoning patterns for what an entity actually implies. SOTA extraction occurs on every new working memory summarization.

## Tech Stack
- Frontend: **Next.js 14+** + Tailwind CSS + Shadcn UI
- Backend: **NestJS** (Express)
- Engine: Google **Gemini 2.0 Flash**
- Persistence Layers: **Neo4j**, **Pinecone**, local JSON stores.
