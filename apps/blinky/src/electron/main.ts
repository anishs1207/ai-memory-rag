import { app, BrowserWindow, ipcMain, desktopCapturer, screen, session } from 'electron';
import { getPreloadPath, getUIPath } from './pathResolver.js';
import { isDev } from './utils.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// Use gemini-2.5-flash as the primary text and multimodal vision model.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
const gemmaModel = model;

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

  // Handle Gemini API
  ipcMain.handle('gemini-chat', async (_, prompt: string) => {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error('Gemma API Error:', err);
      return 'Error calling Gemma API';
    }
  });

  ipcMain.handle('gemma-chat', async (_, prompt: string) => {
    try {
      const result = await gemmaModel.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error('Gemma API Error:', err);
      return 'Error calling Gemma API';
    }
  });

  ipcMain.handle('gemini-vision', async (_, prompt: string, base64Image: string) => {
    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
      ]);
      return result.response.text();
    } catch (err) {
      console.error('Gemma Vision Error:', err);
      return 'Error calling Gemma Vision API';
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

  ipcMain.handle('save-chat-history', async (_, historyItems: any[]) => {
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
      const items = JSON.parse(rawData);

      const loadedItems = items.map((item: any) => {
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

app.on('ready', createWindow);

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
