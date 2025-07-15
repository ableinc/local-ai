// electron/main.js
import pkg from 'electron';
const { app, BrowserWindow } = pkg;
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createConnection } from 'node:net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged

function resolveResourcePath(...segments) {
  const base = isDev
    ? path.join(__dirname, '..')
    : process.resourcesPath
  return path.join(base, ...segments)
}

// Load .env for packaged builds
dotenv.config({ path: resolveResourcePath('server', '.env') });

console.log('Environment:', { isDev, NODE_ENV: process.env.NODE_ENV });

let serverProcess = null;

function startExpressServer() {
  // Use Electron's embedded Node binary
  const nodePath = isDev ? 'node' : process.execPath;
  
  // Get the correct server path
  const serverPath = resolveResourcePath('server', 'index.js');
  console.log('Starting server with:', { nodePath, serverPath });
  
  const env = {
    ...process.env,
    ELECTRON_APP_DATA_PATH: app.getPath('userData'),
    ELECTRON_RUN_AS_NODE: '1'
  };
    
  try {
    serverProcess = spawn(nodePath, [serverPath], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[express]: ${data.toString()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[express error]: ${data.toString()}`);
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server process:', error);
    });

    serverProcess.on('close', (code) => {
      console.log(`Express server exited with code ${code}`);
    });
  } catch (error) {
    console.error('Failed to spawn server process:', error);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    title: 'Local Ai',
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      devTools: true
    },
    show: false // Don't show window until ready
  });

  // Always open DevTools in development
  if (isDev) {
    win.webContents.openDevTools();
  }

  const port = process.env.VITE_API_PORT || 3001;
  const serverUrl = `http://localhost:${port}`;
  
  // Load from your Express server
  win.loadURL(serverUrl).then(() => {
    win.show(); // Show window only after content is loaded
  }).catch((error) => {
    console.error('Failed to load app:', error);
    // Show error in window
    win.loadURL(`data:text/html;charset=utf-8,
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Failed to load application</h1>
          <pre>${error}</pre>
          <p>Server URL: ${serverUrl}</p>
        </body>
      </html>
    `);
    win.show();
  });
}

function waitForServer(port, timeout = 10000) {
  const start = Date.now();
  
  return new Promise((resolve, reject) => {
    const tryConnection = () => {
      const socket = createConnection(port);
      
      socket.on('connect', () => {
        socket.end();
        resolve();
      });
      
      socket.on('error', () => {
        socket.destroy();
        
        if (Date.now() - start > timeout) {
          reject(new Error('Server timeout'));
          return;
        }
        
        // Try again in 100ms
        setTimeout(tryConnection, 100);
      });
    };
    
    tryConnection();
  });
}

app.whenReady().then(async () => {
  startExpressServer();
  
  const port = parseInt(process.env.VITE_API_PORT || '3001');
  console.log('Waiting for server to be ready on port:', port);
  
  try {
    await waitForServer(port);
    console.log('Server is ready, creating window');
    createWindow();
  } catch (error) {
    console.error('Server failed to start:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
