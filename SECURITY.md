# Security Policy

Date: 2026-08-19

The Inqora team takes the security and integrity of our multi-agent intelligence ecosystem, cognitive memory stores, desktop overlays, and APIs seriously. We appreciate the responsible disclosure of security vulnerabilities by the community.

---

## 🛡️ Supported Versions

We actively provide security patches and updates for the following components on the `main` branch:

| Component | Target Ecosystem / Runtime | Supported |
| :--- | :--- | :--- |
| **apps/web** | Next.js 16 / React 19 | :white_check_mark: |
| **apps/server** | Node.js Express / Vector DB / BullMQ | :white_check_mark: |
| **apps/blinky** | Electron / React 19 Overlay | :white_check_mark: |
| **apps/agentos** | Go Agent Execution Runtime | :white_check_mark: |
| **apps/rag-pipeline** | Python FastAPI / RAG Services | :white_check_mark: |
| **apps/mobile-app** | Expo / React Native | :white_check_mark: |
| **packages/\*** | Shared Libraries (`@repo/ui`, orchestrator) | :white_check_mark: |
| **agent-factory/\*** | Sub-agent configurations & tools | :white_check_mark: |

---

## 🚨 Reporting a Vulnerability

If you discover a potential security vulnerability within Inqora or any associated packages, please **do NOT open a public GitHub issue**.

### Preferred Reporting Method
1. **GitHub Security Advisory (Private)**: Submit a draft advisory via GitHub's [Security Advisories](https://github.com/anishs1207/inqora/security/advisories) feature on the repository.
2. **Direct Security Contact**: If private advisories are unavailable, send details to `security@inqora.dev` or directly reach out to the project maintainers.

### What to Include in Your Report
To help us triage and resolve the issue swiftly, please include:
- A description of the vulnerability and its potential impact.
- Affected component(s) (e.g., `apps/server`, `apps/agentos`, `apps/blinky`).
- Step-by-step instructions or Proof-of-Concept (PoC) scripts to reproduce the issue.
- Details of any potential fix or mitigation you might have developed.

---

## ⏱️ Response and Disclosure Timeline

- **Initial Triage**: We will acknowledge receipt of your vulnerability report within **48 hours**.
- **Assessment & Status Updates**: We will provide an assessment and timeline for a patch within **5 business days**.
- **Coordinated Disclosure**: Once a fix is verified and deployed, we will coordinate public disclosure and provide appropriate credit to the reporter.

---

## 🔐 Security Best Practices in Inqora

When building and deploying within the Inqora ecosystem, adhere to the following baseline security practices:

### 1. API Keys & Secrets Management
- Never commit `.env` files or hardcode API keys (OpenAI, Anthropic, Gemini, DeepSeek, Slack tokens, Pinecone, Qdrant).
- Use local `.env` files created from `.env.example` templates and keep them ignored in `.gitignore`.

### 2. LLM Safety & Prompt Injection Mitigation
- Sanitize and validate untrusted user inputs before passing them into agent context and RAG indexing pipelines.
- Apply strict system boundaries and tool execution whitelists when invoking external CLI commands or sandbox execution in `apps/agentos`.

### 3. Desktop Overlay (`apps/blinky`) Sandboxing
- Keep `nodeIntegration: false` and `contextIsolation: true` in Electron BrowserWindow instances.
- Limit IPC exposure to validated channels defined within preload scripts.

### 4. Vector & Memory Privacy
- Isolate workspace memory vectors per user session/tenant.
- Avoid storing plain-text PII (Personally Identifiable Information) in long-term vector embeddings and episodic memory logs.

---

Thank you for helping keep Inqora and the AI ecosystem secure!
