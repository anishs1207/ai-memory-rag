/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');


contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  getSources: () => ipcRenderer.invoke('get-sources'),
  setWindowSize: (width: number, height: number) => ipcRenderer.send('set-window-size', width, height),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  setFullScreen: (full: boolean) => ipcRenderer.send('set-full-screen', full),
  geminiChat: (prompt: string) => ipcRenderer.invoke('gemini-chat', prompt),
  gemmaChat: (prompt: string) => ipcRenderer.invoke('gemma-chat', prompt),
  geminiVision: (prompt: string, base64Image: string) => ipcRenderer.invoke('gemini-vision', prompt, base64Image),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  setContentProtection: (protect: boolean) => ipcRenderer.send('set-content-protection', protect),
  // Expose system execution capabilities safely to launch apps (e.g. Chrome, Notepad)
  executeSystemCommand: (command: string) => ipcRenderer.invoke('execute-system-command', command),
  executePowershellScript: (script: string) => ipcRenderer.invoke('execute-powershell-script', script),
  // Local History Persistence methods
  saveChatHistory: (history: any[]) => ipcRenderer.invoke('save-chat-history', history),
  loadChatHistory: () => ipcRenderer.invoke('load-chat-history'),
  clearChatHistory: () => ipcRenderer.invoke('clear-chat-history'),
});

