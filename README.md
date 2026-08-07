# Inqora

> **Inqora** is an enterprise-grade cognitive memory framework and multi-agent intelligence monorepo. It seamlessly unifies short-term working context, long-term semantic vector memory, knowledge graphs, VLM visual understanding, cross-platform mobile experiences, and hands-free desktop stealth overlays.

---

## 🏗️ Architecture & Directory Structure

Inqora is organized as a high-performance monorepo managed via **Turborepo** and **npm workspaces**.

```text
23-inqora/
├── apps/
│   ├── web/               # Next.js 16 frontend (Blinky showcase, Chat UI, Document OCR, Panel)
│   ├── blinky/            # Electron + React 19 stealth desktop assistant overlay
│   ├── server/            # Node.js Express backend (Vector memory, SQLite, BullMQ, LangChain)
│   ├── agentos/           # Go-based high-performance agent runtime & CLI execution engine
│   ├── rag-pipeline/      # Python FastAPI microservice for RAG document indexing & search
│   ├── mobile-app/        # Cross-platform Expo / React Native app with NativeWind
│   ├── docs/              # Mintlify documentation portal
│   └── ai-video-editor/   # Next-gen visual media processing suite
├── packages/
│   ├── agent-orchestrator/# Shared multi-agent orchestration primitives
│   ├── ui/                # Shared design system & React UI component library (@repo/ui)
│   ├── eslint-config/     # Workspace-wide ESLint configurations
│   ├── tailwind-config/   # Shared Tailwind CSS design system tokens
│   └── typescript-config/ # Strict TypeScript base configurations
├── agent-factory/         # Pre-configured agent sub-systems (e.g. slack-agent)
└── infra/                 # Docker, task runner, and deployment scripts
```

---

## 🌟 Key Application Suites & Capabilities

### 🌐 1. Web Platform (`apps/web`)

- **Tech Stack**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion, Shiki, Recharts.
- **Blinky Landing Page (`/`)**: Ultra-minimalist showcase with smooth micro-animations and high-contrast UI tokens.
- **Memory-Aware Chat (`/chat`)**: Real-time interface revealing context provenance across working memory, vector stores, and knowledge graphs.
- **Document & VLM OCR (`/document-ocr`)**: Multimodal document parsing powered by Gemini 1.5/2.5 Flash and LandingAI ADE.
- **System Panel (`/panel`)**: System status monitoring and configuration management.

### 🎙️ 2. Blinky Stealth Desktop Overlay (`apps/blinky`)

- **Tech Stack**: Electron 34, React 19, Vite, Tailwind CSS.
- **Stealth Dashboard**: Floating overlay with configurable transparency, click-through mode, and screen-share masking (Zoom/Teams friendly).
- **Context Awareness**: Active screen screenshot capture giving immediate visual workspace context to AI agents.
- **Hands-Free Voice**: Real-time Speech-to-Text (STT) and spoken Text-to-Speech (TTS) responses.
- **Native System Execution**: Launches native local Windows/Mac applications based on conversational context.

### ⚡ 3. Backend & Agent Microservices

- **Core Server (`apps/server`)**: Node.js Express service backing multi-tiered vector storage (Pinecone, Qdrant, ChromaDB), SQLite cache, BullMQ job queues, and document processors (`pdfkit`, `mammoth`, `tesseract.js`).
- **AgentOS (`apps/agentos`)**: Ultra-fast Go engine providing CLI management and low-overhead agent orchestration.
- **RAG Microservice (`apps/rag-pipeline`)**: FastAPI & Python microservice dedicated to scalable vector chunking and document retrieval.
- **Mobile App (`apps/mobile-app`)**: iOS & Android client built with Expo Router and NativeWind.

---

## 🧠 Hierarchical Memory System

1.  **Short-Term Working Memory**: Maintains active conversation windows with automated summarization upon exceeding context bounds.
2.  **Long-Term Semantic Vector Memory**: Dual Pinecone and Qdrant retrieval utilizing access frequency and logarithmic memory decay models.
3.  **Knowledge Graph Integration**: Extracts structural entity identities and social relationships, linking evidence with confidence scores.
4.  **Visual Memory (VLM)**: Analyzes photos and screen captures for deep scene descriptions, identity clustering, EXIF geospatial tracking, and neural journal generation.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `>=18.0.0`
- **npm**: `>=10.0.0`
- **Docker & Docker Compose** (Optional, for containerized local services)
- **Go**: `>=1.21` (For `apps/agentos`)
- **Python**: `>=3.10` (For `apps/rag-pipeline`)

### Installation & Environment Setup

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/anishs1207/ai-memory.git
    cd 23-inqora
    ```

2.  **Install Monorepo Dependencies**:

    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory:
    ```env
    GEMINI_API_KEY=your_gemini_api_key
    DATABASE_URL=postgresql://user:password@127.0.0.1:5432/agentic_db?schema=public
    REDIS_HOST=localhost
    REDIS_PORT=6379
    ```

### Local Infrastructure with Docker

Launch PostgreSQL, Redis, backend services, and web apps with Docker Compose:

```bash
docker-compose up -d
```

### Development Commands

Run monorepo tasks across all applications concurrently via **Turborepo**:

```bash
# Start all dev servers (Web on :3000, Server on :3001, Desktop, etc.)
npm run dev

# Compile production builds across all workspaces
npm run build

# Run ESLint validation
npm run lint

# Execute TypeScript typechecking across all packages
npm run check-types

# Execute unit and integration test suites
npm run test
```

---

## 🛠️ Monorepo Package Reference

| Workspace Package          | Type            | Description                                                          |
| -------------------------- | --------------- | -------------------------------------------------------------------- |
| `apps/web`                 | Web Application | Next.js 16 chat interface, VLM document OCR, and Blinky landing page |
| `apps/blinky`              | Desktop App     | Electron floating overlay assistant with speech & local control      |
| `apps/server`              | Express Backend | Core API, vector retrieval, SQLite storage, and BullMQ queues        |
| `apps/agentos`             | Go Service      | High-performance agent execution engine                              |
| `apps/rag-pipeline`        | Python Service  | FastAPI containerized RAG pipeline                                   |
| `apps/mobile-app`          | Mobile Client   | Expo React Native application                                        |
| `apps/docs`                | Documentation   | Mintlify documentation suite                                         |
| `@repo/ui`                 | Shared Package  | Shared React component library                                       |
| `@repo/agent-orchestrator` | Shared Package  | Agent orchestration primitives                                       |

---

## 📜 License

Distributed under the MIT License. See [LICENSE](file:///c:/Users/Anish/Documents/building/23-inqora/LICENSE) for more information.
