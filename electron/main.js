// electron/main.js
import pkg from 'electron';
const { app, BrowserWindow, shell } = pkg;
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
dotenv.config({ path: resolveResourcePath('.env') });

console.log('Environment:', { isDev, NODE_ENV: process.env.NODE_ENV });

let serverProcess = null;
let mainWindow = null;

function startExpressServer() {
  // Use Electron's embedded Node binary
  const nodePath = isDev ? 'node' : process.execPath;
  
  // Get the correct server path
  const serverPath = resolveResourcePath('server.js');
  const betterSqlite3Path = resolveResourcePath('better_sqlite3.node');
  console.log('Starting server with:', { nodePath, serverPath, betterSqlite3Path });
  
  const env = {
    ...process.env,
    ELECTRON_APP_DATA_PATH: app.getPath('userData'),
    ELECTRON_RUN_AS_NODE: '1',
    BETTER_SQLITE3_PATH: betterSqlite3Path,
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
  mainWindow = new BrowserWindow({
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

  const port = process.env.VITE_API_PORT;
  const serverUrl = `http://localhost:${port}`;
  
  // Open links in the user's browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url); // Open URL in user's browser.
    return { action: "deny" }; // Prevent the app from opening the URL.
  });
  // Load from your Express server
  mainWindow.loadURL(serverUrl).then(() => {
    mainWindow.show();
  }).catch((error) => {
    console.error('Failed to load app:', error);
    // Show error in window
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Failed to load application</h1>
          <pre>${error}</pre>
          <p>Server URL: ${serverUrl}</p>
        </body>
      </html>
    `);
    mainWindow.show();
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
  
  // Start server
  startExpressServer();
  
  const port = parseInt(process.env.VITE_API_PORT);
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
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (!serverProcess) {
      const port = parseInt(process.env.VITE_API_PORT);
      console.log('Waiting for server to be ready on port:', port);
      startExpressServer();
      await waitForServer(port);
    }
    createWindow();
  }
});
