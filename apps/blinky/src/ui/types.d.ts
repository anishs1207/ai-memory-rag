export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface HistoryItem {
  id: string;
  prompt: string;
  response: string;
  timestamp: string;
  isVoiceMuted?: boolean;
  hasScreenshot?: boolean;
  base64Screenshot?: string;
  screenshotPath?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  base64Screenshot?: string;
  isError?: boolean;
}

export interface WebResearchResult {
  answer: string;
  sources: Array<{ title: string; url: string }>;
  targetUrl: string;
  tracks: Array<{
    task: string;
    answer: string;
    sources: Array<{ title: string; url: string }>;
    targetUrl: string;
  }>;
}

export interface SiteCredentialSummary {
  domain: string;
  username: string;
  autoFill: boolean;
}

export type TaskStatus = 'planned' | 'running' | 'waiting-approval' | 'paused' | 'completed' | 'failed';
export interface RuntimeSnapshot {
  tasks: Array<{ id: string; goal: string; status: TaskStatus; progress: number; createdAt: string; updatedAt: string; message: string; retries: number; workers: Array<{ id: string; goal: string; status: TaskStatus; progress: number; message: string }>; approvals: Array<{ id: string; title: string; description: string; risk: 'low' | 'medium' | 'high'; status: 'pending' | 'approved' | 'rejected' }>; evidence: Array<{ id: string; title: string; url: string; excerpt?: string; screenshot?: string; confidence: number; capturedAt: string; workerId?: string }> }>;
  profiles: Array<{ id: string; name: string; color: string; partition: string; createdAt: string }>;
  templates: Array<{ id: string; name: string; prompt: string; category: string }>;
  schedules: Array<{ id: string; name: string; prompt: string; intervalMinutes: number; enabled: boolean; nextRunAt: string }>;
  memories: Array<{ id: string; label: string; value: string; createdAt: string }>;
}

export interface ElectronAPI {
  platform: string;
  getSources: () => Promise<ScreenSource[]>;
  setWindowSize: (width: number, height: number) => void;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  setFullScreen: (full: boolean) => void;
  quitApp: () => void;
  claudeChat: (prompt: string) => Promise<string>;
  claudeVision: (prompt: string, base64Image: string) => Promise<string>;
  claudeWebResearch: (goal: string) => Promise<
    { success: true; result: WebResearchResult } | { success: false; error: string }
  >;
  listSiteCredentials: () => Promise<SiteCredentialSummary[]>;
  saveSiteCredential: (credential: { domain: string; username: string; password: string; autoFill: boolean }) => Promise<SiteCredentialSummary>;
  deleteSiteCredential: (domain: string) => Promise<void>;
  applySiteCredential: (webContentsId: number, pageUrl: string) => Promise<boolean>;
  getRuntimeSnapshot: () => Promise<RuntimeSnapshot>;
  dispatchTaskCommand: (command: unknown) => Promise<RuntimeSnapshot>;
  requestTaskApproval: (taskId: string, approval: unknown) => Promise<RuntimeSnapshot>;
  transcribeSpeech: () => Promise<
    { success: true; text: string; confidence: number } | { success: false; error: string }
  >;
  startWindowsVoiceTyping: () => Promise<{ success: boolean; error?: string }>;
  cancelSpeechRecognition: () => void;
  captureScreen: () => Promise<string>;
  setContentProtection: (protect: boolean) => void;
  executeSystemCommand: (command: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>;
  executePowershellScript: (script: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>;
  saveChatHistory: (history: HistoryItem[]) => Promise<{ success: boolean; error?: string }>;
  loadChatHistory: () => Promise<HistoryItem[]>;
  clearChatHistory: () => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
