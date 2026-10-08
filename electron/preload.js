const { contextBridge } = require('electron');

// Intentionally minimal: the renderer talks to the backend over plain HTTP/WS
// (same as the web build), so no privileged Node/Electron APIs need to be
// exposed here. This keeps the renderer sandboxed.
contextBridge.exposeInMainWorld('winsecApp', {
  platform: process.platform,
  isElectron: true,
});
