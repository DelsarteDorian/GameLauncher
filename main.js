const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const SettingsManager = require('./src/settings-manager');

let mainWindow;
let settingsManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff'
    }
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  settingsManager = new SettingsManager();
  createWindow();
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

// IPC handlers
ipcMain.handle('scan-games', async () => {
  const gameScanner = require('./src/game-scanner');
  return await gameScanner.scanForGames();
});

ipcMain.handle('launch-game', async (event, game) => {
  try {
    console.log(`Launching game: ${game.name} (${game.platform})`);
    
    switch (game.launchMethod) {
      case 'epic-launcher':
        // Try to launch via Epic Games Launcher
        const epicLauncherPath = 'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe';
        if (fs.existsSync(epicLauncherPath)) {
          spawn(epicLauncherPath, ['-com.epicgames.launcher://'], {
            detached: true,
            stdio: 'ignore'
          });
          return { success: true, message: 'Launched via Epic Games Launcher' };
        } else {
          // Fallback: direct launch
          spawn(game.path, [], {
            detached: true,
            stdio: 'ignore'
          });
          return { success: true, message: 'Launched directly (Epic Launcher not found)' };
        }
        
      case 'origin-launcher':
        // Try to launch via Origin
        const originPath = 'C:\\Program Files (x86)\\Origin\\Origin.exe';
        if (fs.existsSync(originPath)) {
          spawn(originPath, [], {
            detached: true,
            stdio: 'ignore'
          });
          return { success: true, message: 'Origin opened - launch game manually' };
        } else {
          // Fallback: direct launch
          spawn(game.path, [], {
            detached: true,
            stdio: 'ignore'
          });
          return { success: true, message: 'Launched directly (Origin not found)' };
        }
        
      case 'direct':
      default:
        // Direct executable launch
        if (game.path.endsWith('.exe')) {
          spawn(game.path, [], {
            detached: true,
            stdio: 'ignore',
            cwd: path.dirname(game.path) // Important: set working directory
          });
        } else {
          shell.openPath(game.path);
        }
        return { success: true, message: 'Game launched directly' };
    }
  } catch (error) {
    console.error('Launch error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-custom-icon', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'webp'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('save-game-data', async (event, gameData) => {
  const dataPath = path.join(app.getPath('userData'), 'games.json');
  try {
    fs.writeFileSync(dataPath, JSON.stringify(gameData, null, 2));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-game-data', async () => {
  const dataPath = path.join(app.getPath('userData'), 'games.json');
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    return [];
  }
});

// Settings management
ipcMain.handle('get-settings', async () => {
  return settingsManager.settings;
});

ipcMain.handle('add-custom-path', async (event, customPath) => {
  return settingsManager.addCustomGamePath(customPath);
});

ipcMain.handle('remove-custom-path', async (event, customPath) => {
  return settingsManager.removeCustomGamePath(customPath);
});

ipcMain.handle('get-custom-paths', async () => {
  return settingsManager.getCustomGamePaths();
});

ipcMain.handle('update-setting', async (event, key, value) => {
  return settingsManager.updateSetting(key, value);
});

ipcMain.handle('reset-settings', async () => {
  return settingsManager.resetToDefaults();
});

ipcMain.handle('check-path-exists', async (event, path) => {
  try {
    return fs.existsSync(path);
  } catch (error) {
    console.error('Error checking path:', error);
    return false;
  }
});

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Sélectionner un dossier de jeux'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('Error selecting folder:', error);
    return null;
  }
});

// Window controls
ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow.close();
});