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

export interface ElectronAPI {
  getSources: () => Promise<ScreenSource[]>;
  setWindowSize: (width: number, height: number) => void;
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  setFullScreen: (full: boolean) => void;
  geminiChat: (prompt: string) => Promise<string>;
  gemmaChat: (prompt: string) => Promise<string>;
  geminiVision: (prompt: string, base64Image: string) => Promise<string>;
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