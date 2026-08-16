/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

interface HistoryItem {
  id: string;
  prompt: string;
  response: string;
  timestamp: string;
  isVoiceMuted?: boolean;
  hasScreenshot?: boolean;
  base64Screenshot?: string;
  screenshotPath?: string;
}
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  getSources: () => ipcRenderer.invoke('get-sources'),
  setWindowSize: (width: number, height: number) => ipcRenderer.send('set-window-size', width, height),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  setFullScreen: (full: boolean) => ipcRenderer.send('set-full-screen', full),
  quitApp: () => ipcRenderer.send('quit-app'),
  claudeChat: (prompt: string) => ipcRenderer.invoke('claude-chat', prompt),
  claudeVision: (prompt: string, base64Image: string) => ipcRenderer.invoke('claude-vision', prompt, base64Image),
  claudeWebResearch: (goal: string) => ipcRenderer.invoke('claude-web-research', goal),
  listSiteCredentials: () => ipcRenderer.invoke('credentials-list'),
  saveSiteCredential: (credential: { domain: string; username: string; password: string; autoFill: boolean }) => ipcRenderer.invoke('credentials-save', credential),
  deleteSiteCredential: (domain: string) => ipcRenderer.invoke('credentials-delete', domain),
  applySiteCredential: (webContentsId: number, pageUrl: string) => ipcRenderer.invoke('credentials-apply', webContentsId, pageUrl),
  getRuntimeSnapshot: () => ipcRenderer.invoke('runtime-snapshot'),
  dispatchTaskCommand: (command: unknown) => ipcRenderer.invoke('runtime-dispatch', command),
  requestTaskApproval: (taskId: string, approval: unknown) => ipcRenderer.invoke('runtime-request-approval', taskId, approval),
  transcribeSpeech: () => ipcRenderer.invoke('transcribe-windows-speech'),
  startWindowsVoiceTyping: () => ipcRenderer.invoke('start-windows-voice-typing'),
  cancelSpeechRecognition: () => ipcRenderer.send('cancel-windows-speech'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  setContentProtection: (protect: boolean) => ipcRenderer.send('set-content-protection', protect),
  // Expose system execution capabilities safely to launch apps (e.g. Chrome, Notepad)
  executeSystemCommand: (command: string) => ipcRenderer.invoke('execute-system-command', command),
  executePowershellScript: (script: string) => ipcRenderer.invoke('execute-powershell-script', script),
  // Local History Persistence methods
  saveChatHistory: (history: HistoryItem[]) => ipcRenderer.invoke('save-chat-history', history),
  loadChatHistory: () => ipcRenderer.invoke('load-chat-history'),
  clearChatHistory: () => ipcRenderer.invoke('clear-chat-history'),
});
