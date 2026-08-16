import { app, BrowserWindow, ipcMain, desktopCapturer, screen, session } from 'electron';
import { getPreloadPath, getUIPath } from './pathResolver.js';
import { isDev } from './utils.js';
import { loadBlinkyEnvironment } from './environment.js';
import { detectImageMediaType, type ClaudeImageMediaType } from './imageMediaType.js';
import { planResearchTracks, researchWeb } from './webResearchAgent.js';
import { applySiteCredential, deleteSiteCredential, listSiteCredentials, saveSiteCredential, type SiteCredentialInput } from './credentialVault.js';
import { addTaskApproval, dispatchTaskCommand, getRuntimeSnapshot, type TaskCommand } from './taskRuntime.js';
import path from 'path';
import { exec, spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';

loadBlinkyEnvironment();

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

type SpeechTranscriptionResult =
  | { success: true; text: string; confidence: number }
  | { success: false; error: string };

let speechRecognitionProcess: ChildProcessWithoutNullStreams | null = null;

function transcribeWindowsSpeech(): Promise<SpeechTranscriptionResult> {
  if (process.platform !== 'win32') {
    return Promise.resolve({ success: false, error: 'Native speech recognition is only available on Windows.' });
  }
  if (speechRecognitionProcess) {
    return Promise.resolve({ success: false, error: 'Blinky is already listening.' });
  }

  const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$installed = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
if ($installed.Count -eq 0) { throw 'No Windows speech recognizer is installed.' }
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
try {
  $recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $recognizer.SetInputToDefaultAudioDevice()
  $result = $recognizer.Recognize([TimeSpan]::FromSeconds(12))
  if ($null -eq $result) {
    @{ success = $false; error = 'I could not hear any speech. Please try again.' } | ConvertTo-Json -Compress
  } else {
    @{ success = $true; text = $result.Text; confidence = $result.Confidence } | ConvertTo-Json -Compress
  }
} finally {
  $recognizer.Dispose()
}`;
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', encodedScript,
    ], { windowsHide: true });
    speechRecognitionProcess = child;
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', (error) => {
      speechRecognitionProcess = null;
      resolve({ success: false, error: `Could not start speech recognition: ${error.message}` });
    });
    child.on('close', (exitCode) => {
      if (speechRecognitionProcess === child) speechRecognitionProcess = null;
      if (exitCode !== 0) {
        resolve({ success: false, error: stderr.trim() || 'Windows speech recognition failed.' });
        return;
      }
      try {
        const jsonLine = stdout.trim().split(/\r?\n/).at(-1);
        if (!jsonLine) throw new Error('Speech recognizer returned no result.');
        resolve(JSON.parse(jsonLine) as SpeechTranscriptionResult);
      } catch (error) {
        resolve({ success: false, error: (error as Error).message });
      }
    });
  });
}

function startWindowsVoiceTyping(): Promise<{ success: boolean; error?: string }> {
  if (process.platform !== 'win32') return Promise.resolve({ success: false, error: 'Windows Voice Typing is unavailable.' });
  const script = String.raw`
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class BlinkyKeyboard {
  [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
}
'@
[BlinkyKeyboard]::keybd_event(0x5B, 0, 0, [UIntPtr]::Zero)
[BlinkyKeyboard]::keybd_event(0x48, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[BlinkyKeyboard]::keybd_event(0x48, 0, 2, [UIntPtr]::Zero)
[BlinkyKeyboard]::keybd_event(0x5B, 0, 2, [UIntPtr]::Zero)`;
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript], { windowsHide: true });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', (error) => resolve({ success: false, error: error.message }));
    child.on('close', (code) => resolve(code === 0 ? { success: true } : { success: false, error: stderr.trim() || 'Could not open Windows Voice Typing.' }));
  });
}

type ClaudeContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: ClaudeImageMediaType; data: string } };

interface ClaudeResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

interface BrowserActionPlan {
  summary: string;
  requiresApproval: boolean;
  riskReason?: string;
  actions: Array<{ type: 'click' | 'type' | 'select' | 'extract' | 'scroll'; selector?: string; value?: string; description: string }>;
}

async function callClaude(content: ClaudeContent[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is missing. Add it to apps/blinky/.env.');
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    }),
  });

  const payload = await response.json() as ClaudeResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Anthropic API returned ${response.status}`);
  }

  const text = payload.content
    ?.filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Claude returned no text content.');
  return text;
}

async function planBrowserActions(goal: string, pageUrl: string, pageSnapshot: string): Promise<BrowserActionPlan> {
  const response = await callClaude([{ type: 'text', text: `You control one browser page for Blinky.
Goal: ${goal}
Page URL: ${pageUrl}
Visible interactive DOM summary:
${pageSnapshot.slice(0, 24000)}

Return ONLY JSON matching:
{"summary":"what this batch does","requiresApproval":false,"riskReason":"","actions":[{"type":"click|type|select|extract|scroll","selector":"exact CSS selector from the snapshot","value":"text or select value","description":"visible action"}]}

Rules:
- Maximum 8 actions. Use only selectors present in the snapshot.
- Never read or return password values.
- requiresApproval MUST be true before submitting forms, sending messages, publishing, purchasing, uploading, deleting, changing account data, accepting terms, or any irreversible action.
- Filling non-sensitive fields, navigation, scrolling, and extraction may proceed without approval.
- Do not invent completion. The renderer verifies every action.` }]);
  const match = response.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Browser agent returned no action plan.');
  const plan = JSON.parse(match[0]) as BrowserActionPlan;
  const allowed = new Set(['click', 'type', 'select', 'extract', 'scroll']);
  plan.actions = (plan.actions || []).filter((action) => allowed.has(action.type)).slice(0, 8);
  return plan;
}

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
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 60,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Enable <webview> tag support for the AI Here browser
    },
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') {
      return true;
    }
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  const primaryDisplay = screen.getPrimaryDisplay();

  const { width } = primaryDisplay.workAreaSize;
  mainWindow.setPosition(Math.floor((width - 800) / 2), 20);

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5123');
  } else {
    mainWindow.loadFile(getUIPath());
  }

  // Handle window resizing and repositioning dynamically
  ipcMain.on('set-window-size', (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setSize(width, height);
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
      
      // If the window is in compact toolbar mode (small height), position it near the top.
      // Otherwise, center it on screen for larger meeting panels or webviews.
      if (height <= 80) {
        win.setPosition(Math.floor((screenWidth - width) / 2), 20);
      } else {
        win.setPosition(Math.floor((screenWidth - width) / 2), Math.floor((screenHeight - height) / 2));
      }
    }
  });

  // Handle setting window content protection (makes the window invisible to screen-sharing apps like Zoom/Teams)
  ipcMain.on('set-content-protection', (event, protect: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setContentProtection(protect);
    }
  });

  ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean, options?: { forward: boolean }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  ipcMain.on('set-full-screen', (event, full: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (full) {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.bounds;
        win.setSize(width, height);
        win.setPosition(0, 0);
        win.setAlwaysOnTop(true, 'screen-saver');
      } else {
        win.setSize(800, 500);
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width } = primaryDisplay.workAreaSize;
        win.setPosition(Math.floor((width - 800) / 2), 20);
      }
    }
  });

  // Handle Claude text and multimodal requests in the privileged main process.
  ipcMain.handle('claude-chat', async (_, prompt: string) => {
    try {
      return await callClaude([{ type: 'text', text: prompt }]);
    } catch (err) {
      console.error('Claude API Error:', err);
      return `Error calling Claude API: ${(err as Error).message}`;
    }
  });

  ipcMain.handle('claude-vision', async (_, prompt: string, base64Image: string) => {
    try {
      return await callClaude([
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: detectImageMediaType(base64Image),
            data: base64Image,
          },
        },
        { type: 'text', text: prompt },
      ]);
    } catch (err) {
      console.error('Claude Vision Error:', err);
      return `Error calling Claude Vision API: ${(err as Error).message}`;
    }
  });

  ipcMain.handle('claude-web-plan', async (_, goal: string) => {
    try {
      return { success: true, tracks: await planResearchTracks(goal) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
  ipcMain.handle('claude-web-research', async (_, goal: string, plannedTracks?: string[]) => {
    try {
      return { success: true, result: await researchWeb(goal, plannedTracks) };
    } catch (err) {
      console.error('Claude Web Agent Error:', err);
      return { success: false, error: (err as Error).message };
    }
  });
  ipcMain.handle('browser-plan-actions', (_, goal: string, pageUrl: string, pageSnapshot: string) => planBrowserActions(goal, pageUrl, pageSnapshot));

  ipcMain.handle('credentials-list', () => listSiteCredentials());
  ipcMain.handle('credentials-save', (_, credential: SiteCredentialInput) => saveSiteCredential(credential));
  ipcMain.handle('credentials-delete', (_, domain: string) => deleteSiteCredential(domain));
  ipcMain.handle('credentials-apply', (_, webContentsId: number, pageUrl: string) =>
    applySiteCredential(webContentsId, pageUrl)
  );
  ipcMain.handle('runtime-snapshot', () => getRuntimeSnapshot());
  ipcMain.handle('runtime-dispatch', (_, command: TaskCommand) => dispatchTaskCommand(command));
  ipcMain.handle('runtime-request-approval', (_, taskId: string, approval) => addTaskApproval(taskId, approval));

  ipcMain.handle('transcribe-windows-speech', () => transcribeWindowsSpeech());
  ipcMain.handle('start-windows-voice-typing', () => startWindowsVoiceTyping());
  ipcMain.on('cancel-windows-speech', () => {
    if (speechRecognitionProcess) {
      speechRecognitionProcess.kill();
      speechRecognitionProcess = null;
    }
  });

  ipcMain.handle('capture-screen', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        // Temporarily hide the window so it does not block the desktop snapshot
        win.hide();
        // Allow time for the window to disappear from screen buffer
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      const primaryDisplay = screen.getPrimaryDisplay();
      const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: primaryDisplay.size 
      });
      const source = sources[0]; // Assume primary screen

      // Restore the window visibility immediately after capture
      if (win) {
        win.show();
      }

      if (source) {
        return source.thumbnail.toDataURL();
      }
      return '';
    } catch (err) {
      console.error('Capture screen error:', err);
      return '';
    }
  });

  // Handler to execute custom PowerShell scripts generated by LLM for advanced automation
  ipcMain.handle('execute-powershell-script', async (_, scriptContent: string) => {
    return new Promise((resolve) => {
      const tempDirectory = app.getPath('temp');
      const tempScriptPath = path.join(tempDirectory, `blinky-automation-${Date.now()}.ps1`);

      try {
        // Write the script block to a temporary powershell file
        fs.writeFileSync(tempScriptPath, scriptContent, 'utf-8');
      } catch (err) {
        console.error('Failed to write temp PowerShell script:', err);
        resolve({ success: false, error: (err as Error).message });
        return;
      }

      // Execute script with Bypass policy so it runs successfully on Windows machines
      exec(`powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`, (error, stdout, stderr) => {
        // Clean up the temp script file immediately after execution
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath);
          }
        } catch (cleanupError) {
          console.error('Failed to delete temp script file:', cleanupError);
        }

        if (error) {
          console.error(`Automation execution failed:`, error);
          resolve({ success: false, error: error.message, stderr });
        } else {
          resolve({ success: true, stdout, stderr });
        }
      });
    });
  });

  // Handler to safely launch Windows applications or URLs requested by the voice companion
  ipcMain.handle('execute-system-command', async (_, commandString: string) => {
    return new Promise((resolve) => {
      const cleanCommand = commandString.trim().toLowerCase();
      let systemCommand = '';

      // Map clean keyword intents to Windows executables/commands
      if (cleanCommand === 'notepad') {
        systemCommand = 'notepad.exe';
      } else if (cleanCommand === 'calc' || cleanCommand === 'calculator') {
        systemCommand = 'calc.exe';
      } else if (cleanCommand === 'chrome' || cleanCommand === 'google chrome') {
        systemCommand = 'start chrome';
      } else if (cleanCommand === 'edge' || cleanCommand === 'microsoft edge') {
        systemCommand = 'start msedge';
      } else if (cleanCommand === 'paint' || cleanCommand === 'mspaint') {
        systemCommand = 'mspaint.exe';
      } else if (cleanCommand === 'explorer' || cleanCommand === 'file explorer') {
        systemCommand = 'explorer.exe';
      } else if (cleanCommand === 'terminal' || cleanCommand === 'cmd') {
        systemCommand = 'start cmd.exe';
      } else if (cleanCommand === 'powershell') {
        systemCommand = 'start powershell.exe';
      } else if (cleanCommand.startsWith('http://') || cleanCommand.startsWith('https://')) {
        systemCommand = `start ${commandString}`;
      } else {
        // Fallback validation: only allow safe characters for custom commands/file paths
        if (/^[a-zA-Z0-9\s._\\/:-]+$/.test(commandString)) {
          systemCommand = commandString;
        } else {
          resolve({ success: false, error: 'Command validation failed (unsafe characters)' });
          return;
        }
      }

      exec(systemCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Execution failed for system command "${systemCommand}":`, error);
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, stdout, stderr });
        }
      });
    });
  });

  // Handle screen capture sources request
  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  });

  // --- LOCAL HISTORY PERSISTENCE IPC HANDLERS ---
  const getHistoryDir = () => {
    const dir = path.join(app.getPath('userData'), 'history');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  const getCapturesDir = () => {
    const dir = path.join(getHistoryDir(), 'captures');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  ipcMain.handle('save-chat-history', async (_, historyItems: HistoryItem[]) => {
    try {
      const historyDir = getHistoryDir();
      const capturesDir = getCapturesDir();
      const chatsPath = path.join(historyDir, 'chats.json');

      const processedItems = historyItems.map((item) => {
        const itemCopy = { ...item };
        if (itemCopy.base64Screenshot) {
          try {
            const fileName = `${itemCopy.id || Date.now()}.png`;
            const filePath = path.join(capturesDir, fileName);
            const base64Data = itemCopy.base64Screenshot.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
            itemCopy.screenshotPath = fileName;
            delete itemCopy.base64Screenshot;
          } catch (imgErr) {
            console.error('Failed to save screenshot file:', imgErr);
          }
        }
        return itemCopy;
      });

      fs.writeFileSync(chatsPath, JSON.stringify(processedItems, null, 2), 'utf-8');
      return { success: true };
    } catch (err) {
      console.error('Failed to save chat history:', err);
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('load-chat-history', async () => {
    try {
      const historyDir = getHistoryDir();
      const capturesDir = getCapturesDir();
      const chatsPath = path.join(historyDir, 'chats.json');

      if (!fs.existsSync(chatsPath)) {
        return [];
      }

      const rawData = fs.readFileSync(chatsPath, 'utf-8');
      const items = JSON.parse(rawData) as HistoryItem[];

      const loadedItems = items.map((item) => {
        if (item.screenshotPath) {
          const imgPath = path.join(capturesDir, item.screenshotPath);
          if (fs.existsSync(imgPath)) {
            const buffer = fs.readFileSync(imgPath);
            item.base64Screenshot = `data:image/png;base64,${buffer.toString('base64')}`;
          }
        }
        return item;
      });

      return loadedItems;
    } catch (err) {
      console.error('Failed to load chat history:', err);
      return [];
    }
  });

  ipcMain.handle('clear-chat-history', async () => {
    try {
      const historyDir = getHistoryDir();
      const chatsPath = path.join(historyDir, 'chats.json');
      if (fs.existsSync(chatsPath)) {
        fs.unlinkSync(chatsPath);
      }
      const capturesDir = getCapturesDir();
      if (fs.existsSync(capturesDir)) {
        const files = fs.readdirSync(capturesDir);
        for (const file of files) {
          fs.unlinkSync(path.join(capturesDir, file));
        }
      }
      return { success: true };
    } catch (err) {
      console.error('Failed to clear chat history:', err);
      return { success: false, error: (err as Error).message };
    }
  });
}

let scheduleMonitorRunning = false;
async function runDueSchedules(): Promise<void> {
  if (scheduleMonitorRunning) return;
  scheduleMonitorRunning = true;
  try {
    const snapshot = getRuntimeSnapshot();
    const due = snapshot.schedules.filter((schedule) => schedule.enabled && new Date(schedule.nextRunAt).getTime() <= Date.now());
    for (const schedule of due) {
      const created = dispatchTaskCommand({ type: 'create', goal: schedule.prompt, workerGoals: ['Scheduled research', 'Verification', 'Synthesis'] });
      const taskId = created.tasks[0]?.id;
      if (taskId) dispatchTaskCommand({ type: 'status', taskId, status: 'running', message: `Running schedule: ${schedule.name}` });
      try {
        const result = await researchWeb(schedule.prompt);
        if (taskId) {
          result.sources.slice(0, 12).forEach((source) => dispatchTaskCommand({ type: 'evidence', taskId, evidence: { title: source.title, url: source.url, confidence: 0.8 } }));
          dispatchTaskCommand({ type: 'status', taskId, status: 'completed', message: result.answer.slice(0, 500) });
        }
      } catch (error) {
        if (taskId) dispatchTaskCommand({ type: 'status', taskId, status: 'failed', message: (error as Error).message });
      }
      dispatchTaskCommand({ type: 'schedule-save', schedule: { ...schedule, nextRunAt: new Date(Date.now() + Math.max(5, schedule.intervalMinutes) * 60_000).toISOString() } });
    }
  } finally {
    scheduleMonitorRunning = false;
  }
}

ipcMain.on('quit-app', () => {
  app.quit();
});

app.on('ready', () => {
  createWindow();
  void runDueSchedules();
  setInterval(() => void runDueSchedules(), 60_000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
