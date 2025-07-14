// electron/main.js
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';

let serverProcess = null;

function startExpressServer() {
  // Run Express server from ./server/index.js
  const serverPath = path.join(__dirname, '../resources/server/index.js');
  serverProcess = spawn('node', [serverPath]);

  serverProcess.stdout.on('data', (data) => {
    console.log(`[express]: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[express error]: ${data}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Express server exited with code ${code}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexPath = path.join(__dirname, '../dist/index.html'); // or ../build/index.html
  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  startExpressServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
