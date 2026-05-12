import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron';
import { getPreloadPath, getUIPath } from './pathResolver.js';
import { isDev } from './utils.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// Defaulting to Gemma as Gemini is currently failing with 404
const model = genAI.getGenerativeModel({ model: 'gemma-4-31b-it' });
const gemmaModel = model; // Use the same for both for now

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 60, // Start as a small bar
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Center on top
  const primaryDisplay = screen.getPrimaryDisplay();

  const { width } = primaryDisplay.workAreaSize;
  mainWindow.setPosition(Math.floor((width - 800) / 2), 20);

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5123');
  } else {
    mainWindow.loadFile(getUIPath());
  }

  // Handle window resizing
  ipcMain.on('set-window-size', (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setSize(width, height);
      if (width > 1000) { // Assume full screen if width is large
        win.center();
      }
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

  ipcMain.handle('capture-screen', async () => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: primaryDisplay.size 
      });
      const source = sources[0]; // Assume primary screen
      if (source) {
        return source.thumbnail.toDataURL();
      }
      return '';
    } catch (err) {
      console.error('Capture screen error:', err);
      return '';
    }
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