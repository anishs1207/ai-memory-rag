import { app, BrowserWindow } from 'electron';
import { getPreloadPath, getUIPath } from './pathResolver.js';
import { isDev } from './utils.js';

app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5123');
  } else {
    mainWindow.loadFile(getUIPath());
  }
});