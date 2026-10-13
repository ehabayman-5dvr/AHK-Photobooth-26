const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('booth', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: settings => ipcRenderer.invoke('settings:save', settings),
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  generate: (photo, era) => ipcRenderer.invoke('generation:start', photo, era),
  cancelGeneration: () => ipcRenderer.invoke('generation:cancel'),
  deliver: (image, era, demo) => ipcRenderer.invoke('photo:deliver', image, era, demo),
  retryUpload: filename => ipcRenderer.invoke('photo:upload-retry', filename),
  printPhoto: image => ipcRenderer.invoke('photo:print', image),
  enterKiosk: () => ipcRenderer.invoke('kiosk:enter'),
  onAdmin: callback => { const listener = () => callback(); ipcRenderer.on('admin-open', listener); return () => ipcRenderer.removeListener('admin-open', listener); },
});
