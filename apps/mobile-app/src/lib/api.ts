import { create } from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

const getBaseUrl = (): string => {
  if (Platform.OS === "web") return "http://localhost:3001";
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip) return `http://${ip}:3001`;
  }
  return Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://localhost:3001";
};

export const SERVER_URL = getBaseUrl();
console.log("[API] Resolved Backend Server URL:", SERVER_URL);

export const api = create({ baseURL: SERVER_URL, timeout: 60000 });

export type ModelType = "general" | "finance" | "legal" | "pdf" | "budget" | "research";

export type ChatAttachment = {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  kind: "image" | "document" | "audio";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  reasoning?: { steps: { title: string; content: string; status: "complete" | "running" | "pending" }[] };
  toolCalls?: { name: string; args: Record<string, unknown>; status: "pending" | "success" | "error" }[];
  requiresConfirmation?: boolean;
  confirmed?: boolean;
  pdfUrl?: string;
  createdAt?: number;
  pending?: boolean;
  retryText?: string;
  comparison?: { label: string; content: string };
  attachments?: ChatAttachment[];
};

export type Conversation = {
  id: string;
  title: string;
  model: ModelType;
  messages: ChatMessage[];
  selectedFile?: string;
  timestamp: number;
  llm?: "gemini" | "smollm" | "sf_financial_qa" | "dpo_adapter";
  pinned?: boolean;
  draft?: string;
};

export const ROUTE_MAP: Record<Exclude<ModelType, "pdf" | "budget">, string> = {
  general: "/api/v1/message/general",
  finance: "/api/v1/message/finance",
  legal: "/api/v1/message/legal",
  research: "/api/v1/message/research",
};

export const chatService = {
  async sendMessage(model: Exclude<ModelType, "pdf" | "budget">, prompt: string, llm?: string, signal?: AbortSignal) {
    const payload = model === "research" ? { topic: prompt, llm } : { prompt, llm };
    const response = await api.post<{ success: boolean; data?: string; error?: string; pdfUrl?: string }>(ROUTE_MAP[model], payload, { signal });
    return response.data;
  },

  async sendPdfMessage(prompt: string, fileName: string, llm?: string, signal?: AbortSignal) {
    const response = await api.post<{ success: boolean; data?: string; error?: string }>("/api/v1/message/chat-file", { prompt, fileName, llm }, { signal });
    return response.data;
  },

  async getFiles() {
    const response = await api.get<{ success: boolean; data: string[] }>("/api/v1/message/get-files");
    return response.data;
  },

  async uploadFile(formData: FormData, onProgress?: (percent: number) => void) {
    const response = await api.post<{ success: boolean; jobId?: string; error?: string }>("/api/v1/message/upload-file", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded * 100) / event.total));
      },
    });
    return response.data;
  },

  async getUploadStatus(jobId: string) {
    const response = await api.get<{ success: boolean; data: { jobId: string; state: string; progress: { processed: number; total: number; percentage: number } | number; failedReason?: string } }>(`/api/v1/message/upload-status/${jobId}`);
    return response.data;
  },
};
