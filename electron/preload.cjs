const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('booth', {
  openPromptConsole: () => ipcRenderer.invoke('prompt:console'),
  onPromptLog: callback => { const listener = (_, details) => callback(details); ipcRenderer.on('prompt:log', listener); return () => ipcRenderer.removeListener('prompt:log', listener); },
  importEnvSettings: () => ipcRenderer.invoke('settings:import-env'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: settings => ipcRenderer.invoke('settings:save', settings),
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  generate: (photo, era, faces) => ipcRenderer.invoke('generation:start', photo, era, faces),
  cancelGeneration: () => ipcRenderer.invoke('generation:cancel'),
  deliver: (image, era, demo) => ipcRenderer.invoke('photo:deliver', image, era, demo),
  retryUpload: filename => ipcRenderer.invoke('photo:upload-retry', filename),
  printPhoto: image => ipcRenderer.invoke('photo:print', image),
  enterKiosk: () => ipcRenderer.invoke('kiosk:enter'),
  onAdmin: callback => { const listener = () => callback(); ipcRenderer.on('admin-open', listener); return () => ipcRenderer.removeListener('admin-open', listener); },
});
