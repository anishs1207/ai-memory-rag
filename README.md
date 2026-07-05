# Inqora: AI Agent Memory Framework

> A sophisticated cognitive memory framework for AI agents, integrating short-term conversation context, long-term semantic retrieval, persistent knowledge graphs, VLM visual memory, and hands-free desktop overlays.

---

## 🌟 Key Features

### 🧠 1. Hierarchical Multi-Tier Memory
*   **Short-Term Context (Working Memory)**: Keeps track of active conversations with a rolling window of recent turns and autonomous summarization when token limits are exceeded.
*   **Long-Term Semantic Retrieval**: Leverages high-performance vector retrieval with Pinecone and Gemini embeddings, utilizing access-frequency tracking and logarithmic memory decay to simulate organic forgetfulness.
*   **Persistent Knowledge Graph**: Extracts structural entity identities and social relationships from conversation content using LLMs, rendering links with evidence-based confidence levels.
*   **Memory-Aware Chat Interface**: A web interface that visualizes exact memory sources (short-term, vector, or graph) utilized in every response.

### 📷 2. VLM Visual Memory System
*   **Deep Scene Analysis**: Analyzes uploaded photos to extract comprehensive descriptions, text (OCR), emotional atmosphere, tags, and location contexts using **Gemini 1.5/2.5 Flash**.
*   **Identity Vault & Face Clustering**: Detects people in photos, automatically crops profiles, refines identity descriptors over time, and supports merging duplicate identities.
*   **Geospatial Tracking**: Extracts EXIF GPS coordinates from photos and maps paths onto an interactive geographic dashboard.
*   **Daily Neural Reflections (Journals)**: Analyzes a day's visual memories to draft written reflections of daily activities and mood, ready to export as compiled PDF "Life Books".
*   **Predictive Path Modeling**: Learns geospatial patterns to predict future locations and relationships.

### 🎙️ 3. Voice-Powered Desktop Overlay
*   **Stealth Dashboard**: A customizable desktop overlay that can be resized into a compact toolbar, made semi-transparent, click-through, or hidden completely from screen-sharing software (Zoom/Teams).
*   **Active Context Capture**: Instantly captures base64 screenshots to give the AI agent immediate visual awareness of your active workspace.
*   **Hands-Free Speech Recognition**: Converse with the assistant via real-time speech-to-text with spoken Text-to-Speech (TTS) agent responses.
*   **Local Application Execution**: Recognizes conversational intent (e.g. "open notepad", "launch chrome", "calculator") and opens native Windows applications locally.

---

## 🚀 Getting Started

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/anishs1207/ai-memory.git
    cd 23-inqora
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Setup**:
    Configure your `.env` variables at the root directory:
    ```env
    GEMINI_API_KEY=your_gemini_api_key
    DATABASE_URL=postgresql://user:password@127.0.0.1:5432/agentic_db?schema=public
    NEO4J_URI=bolt://localhost:7687
    NEO4J_USER=neo4j
    NEO4J_PASSWORD=password
    ```

4.  **Run Development Servers**:
    ```bash
    # Launches backends and Next.js frontend in parallel via Turbo
    npm run dev
    ```

---

## 🛠️ CI/CD & Testing

The monorepo includes a GitHub Actions matrix workflow verifying the codebase on push/pull requests:
*   **Multi-OS Testing Matrix**: Validates compatibility across `ubuntu-latest`, `macos-latest`, and `windows-latest`.
*   **Tests & Verifications**: Compiles builds, checks styles (`npm run lint`), enforces TypeScript compilation (`npm run check-types`), and executes unit tests (`npm run test`).

