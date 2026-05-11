# Backend - Image Memory API

This is the backend service for the **Agentic Framework**, providing an intelligent **Image Memory System**. Built with NestJS, it leverages Google's Vision-Language Model (VLM) to analyze, index, and organize uploaded images.

## Features

- **Image Ingestion & Analysis**: Upload images and automatically extract metadata, high-res scene descriptions, tags, and OCR text using Google Generative AI.
- **Advanced Identity Recognition**: Detects, crops, and identifies individuals across images with high-resolution "Targeted Identity Analysis" for better re-identification accuracy.
- **Relationship Graph**: Builds a consensus-based model of relationships (family, friends, etc.) over multiple sightings, with confidence scores and evidentiary notes.
- **Neural Journals**: Automatically generates daily "Life Journals" summarizing the events and people encountered during a day.
- **Flashbacks & Memory Highlights**: "Today in History" style flashbacks and AI-generated highlights for specific people or locations.
- **Predictive Intelligence**: Analyzes patterns to predict future locations based on historical geospatial data.
- **Similarity Search**: Find images visually similar to an uploaded sample or a specific memory.
- **Event Timeline**: Chronological clustering of images into logical events.
- **Natural Language Interaction**: Soulful, context-aware chat interface to query your personal memory.

## Tech Stack

- **Framework**: [NestJS](https://nestjs.com/)
- **Storage**: JSON-based `ImageMemoryStore` (hardened for persistence)
- **AI Integration**: `@google/generative-ai` (Gemini-2.5-flash VLM)
- **Image Processing**: [Sharp](https://sharp.pixelplumbing.com/)
- **Language**: TypeScript

## Prerequisites

- Node.js (v20+ recommended)
- Google Gemini API Key
- Redis (optional, used for background processing queue)

## Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory. You will need:
   ```env
   GEMINI_API_KEY="your-google-gemini-api-key"
   PORT=3001
   ```

## Running the Application

```bash
# development
npm run start:dev
```

## API Endpoints (`/images`)

### Ingestion & Listing
- `POST /images/upload` — Ingest an image into memory.
- `GET  /images` — List all memory records.
- `GET  /images/:id` — Get specific memory details.
- `GET  /images/:id/file` — Stream the image file.
- `GET  /images/stats` — Memory statistics.

### Identity & People
- `GET  /images/people/all` — List all identified people.
- `GET  /images/people/:personId` — Profile and photos for a person.
- `POST /images/people/:personId/rename` — Update a person's name.
- `POST /images/people/merge` — Merge two identities into one.
- `GET  /images/people/:personId/highlight` — Generate a visual highlight for a person.

### Insights & Exploration
- `GET  /images/relationships/all` — View the full relationship graph.
- `GET  /images/timeline/events` — Chronological event clusters.
- `GET  /images/flashbacks` — Memories from this day in previous years.
- `GET  /images/predictions` — Predicted future locations.
- `GET  /images/journals/all` — List all neural journals.
- `POST /images/journals/generate` — Generate a journal for a specific date.

### Search & Filters
- `GET  /images/search?q=...` — Semantic vector search.
- `GET  /images/filter?tag=...&personId=...` — Filtered memory retrieval.
- `POST /images/similar/:id` — Find similar images to a specific memory.
- `POST /images/search-by-image` — Query memory using a new image.

### Memory Interaction
- `POST /backend/query` — Single-turn natural language query.
- `POST /backend/chat` — Context-aware chat with memory history.

---
*Last Updated: 2026-03-18*
