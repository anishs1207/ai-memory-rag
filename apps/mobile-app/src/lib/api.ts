import { create } from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Resolve backend server URL dynamically
const getBaseUrl = (): string => {
  if (Platform.OS === "web") {
    return "http://localhost:3001";
  }

  // Look up developer machine's IP address via Expo configuration
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip) return `http://${ip}:3001`;
  }

  // Fallbacks
  return Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001";
};

export const SERVER_URL = getBaseUrl();

console.log("[API] Resolved Backend Server URL:", SERVER_URL);

// Create Axios instance
export const api = create({
  baseURL: SERVER_URL,
  timeout: 60000, // 60 seconds timeout
});

export type ModelType = "general" | "finance" | "legal" | "pdf" | "budget" | "research";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  reasoning?: {
    steps: {
      title: string;
      content: string;
      status: "complete" | "running" | "pending";
    }[];
  };
  toolCalls?: {
    name: string;
    args: Record<string, any>;
    status: "pending" | "success" | "error";
  }[];
  requiresConfirmation?: boolean;
  confirmed?: boolean;
  pdfUrl?: string;
};

export type Conversation = {
  id: string;
  title: string;
  model: ModelType;
  messages: ChatMessage[];
  selectedFile?: string;
  timestamp: number;
  // Selected LLM engine engine model name ("gemini", "smollm", "sf_financial_qa", "dpo_adapter")
  llm?: "gemini" | "smollm" | "sf_financial_qa" | "dpo_adapter";
};

// Endpoints map
export const ROUTE_MAP: Record<Exclude<ModelType, "pdf" | "budget">, string> = {
  general: "/api/v1/message/general",
  finance: "/api/v1/message/finance",
  legal: "/api/v1/message/legal",
  research: "/api/v1/message/research",
};

// API Services
export const chatService = {
  // Query normal models (including general, finance, legal, and research)
  async sendMessage(model: Exclude<ModelType, "pdf" | "budget">, prompt: string, llm?: string) {
    // If the model is research, the backend expects "topic" instead of "prompt"
    const payload = model === "research" ? { topic: prompt, llm } : { prompt, llm };
    const response = await api.post<{
      success: boolean;
      data?: string;
      error?: string;
    }>(ROUTE_MAP[model], payload);
    return response.data;
  },

  // Query PDF model with dynamic LLM engine routing
  async sendPdfMessage(prompt: string, fileName: string, llm?: string) {
    const response = await api.post<{
      success: boolean;
      data?: string;
      error?: string;
    }>("/api/v1/message/chat-file", { prompt, fileName, llm });
    return response.data;
  },

  // Fetch all uploaded and indexed files
  async getFiles() {
    const response = await api.get<{
      success: boolean;
      data: string[];
    }>("/api/v1/message/get-files");
    return response.data;
  },

  // Upload file (PDF)
  async uploadFile(formData: FormData, onProgress?: (percent: number) => void) {
    const uploadConfig = {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    } as unknown as Parameters<typeof api.post>[2];

    const response = await api.post<{
      success: boolean;
      jobId?: string;
      error?: string;
    }>("/api/v1/message/upload-file", formData, uploadConfig);
    return response.data;
  },

  // Get status of file processing queue
  async getUploadStatus(jobId: string) {
    const response = await api.get<{
      success: boolean;
      data: {
        jobId: string;
        state: "completed" | "failed" | "active" | "waiting" | "delayed" | string;
        progress: { processed: number; total: number; percentage: number } | number;
        failedReason?: string;
      };
    }>(`/api/v1/message/upload-status/${jobId}`);
    return response.data;
  },
};
