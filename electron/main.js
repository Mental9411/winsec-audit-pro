const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let backendProcess;

const isDev = !app.isPackaged;
const BACKEND_PORT = 8000;

function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else retry(n);
      });
      req.on('error', () => retry(n));
    };
    const retry = (n) => {
      if (n <= 0) return reject(new Error('Backend did not start in time'));
      setTimeout(() => attempt(n - 1), 500);
    };
    attempt(retries);
  });
}

function startBackend() {
  // In a packaged app, the Python backend is expected to be bundled
  // (e.g. via PyInstaller) and placed at resources/backend/winsec-backend(.exe).
  // In dev, we assume `uvicorn` is already running separately (npm run backend).
  if (isDev) return Promise.resolve();

  const backendBinary = process.platform === 'win32' ? 'winsec-backend.exe' : 'winsec-backend';
  const backendPath = path.join(process.resourcesPath, 'backend', backendBinary);

  backendProcess = spawn(backendPath, [], { stdio: 'ignore' });
  backendProcess.on('error', (err) => {
    console.error('Failed to start bundled backend:', err);
  });

  return waitForBackend();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0B0F19',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }

  // Open external links (e.g. AI provider docs) in the OS browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  try {
    await startBackend();
  } catch (e) {
    console.error(e);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
