const { app, BrowserWindow, ipcMain, session, safeStorage, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { ERA_PROMPTS, decodeImage, generateImage, uploadImage, reportMetric } = require('./services.cjs');

// Isolated folders for automated desktop integration checks, disabled in packaged builds.
const testing = !app.isPackaged && !!process.env.AHK_TEST_USER_DATA;
if (testing) app.setPath('userData', path.resolve(process.env.AHK_TEST_USER_DATA));

const defaults = {
  demoMode: true, model: 'gpt-image-2', quality: 'high', cameraId: '', rotation: -90, mirror: true,
  printerName: '', resultSeconds: 90, cloudName: '', cloudKey: '', folder: 'AHK-75-Anniversary',
  dashboardProjectId: '', viewerUrl: 'https://photobooth-viewer.vercel.app/',
};
let win, settings = { ...defaults }, encrypted = {}, activeController, printBusy = false;
let lastEra, variations = {}, deliveredFiles = new Set();
const devUrl = process.env.AHK_DEV_URL;
const configPath = () => path.join(app.getPath('userData'), 'operator-config.json');
const photoFolder = () => testing ? path.join(app.getPath('userData'), 'Photos') : path.join(app.getPath('pictures'), 'AHK-75-Photobooth');
const secret = key => {
  if (key === 'openAIKey' && process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (!encrypted[key]) return '';
  try { return safeStorage.decryptString(Buffer.from(encrypted[key], 'base64')); } catch { return ''; }
};
const publicSettings = () => ({ ...settings, hasOpenAIKey: !!secret('openAIKey'), hasCloudSecret: !!secret('cloudSecret') });
function assertSender(event) {
  if (!win || event.sender !== win.webContents) throw new Error('Untrusted IPC sender.');
  const url = event.senderFrame?.url || '';
  const expected = devUrl ? new URL(devUrl).origin : pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
  if (devUrl ? new URL(url).origin !== expected : url.split('#')[0] !== expected) throw new Error('Untrusted IPC origin.');
}
function handle(name, handler) {
  ipcMain.handle(name, (event, ...args) => { assertSender(event); return handler(...args); });
}
async function createWindow() {
  try {
    const stored = JSON.parse(await fs.readFile(configPath(), 'utf8'));
    settings = { ...defaults, ...stored.settings }; encrypted = stored.encrypted || {};
  } catch { /* First run uses preview mode. */ }
  win = new BrowserWindow({ width: 1080, height: 1920, useContentSize: true, minWidth: 480, minHeight: 700, backgroundColor: '#08182c',
    kiosk: !testing, fullscreen: !testing, frame: true, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(contents === win.webContents && permission === 'media'));
  session.defaultSession.setPermissionCheckHandler((contents, permission) => contents === win.webContents && permission === 'media');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F2') {
      event.preventDefault(); win.setKiosk(false); win.setFullScreen(false); win.webContents.send('admin-open');
    }
    if (win.isKiosk() && ['Escape', 'Alt'].includes(input.key)) event.preventDefault();
  });
  if (devUrl) await win.loadURL(devUrl); else await win.loadFile(path.join(__dirname, '../dist/index.html'));
}
app.whenReady().then(async () => {
  handle('settings:get', publicSettings);
  handle('settings:save', async incoming => {
    const next = {};
    for (const [key, value] of Object.entries(defaults)) next[key] = typeof incoming[key] === typeof value ? incoming[key] : settings[key];
    if (!['gpt-image-2', 'gpt-image-1.5'].includes(next.model)) throw new Error('Unsupported image model.');
    if (!['low', 'medium', 'high'].includes(next.quality)) throw new Error('Invalid image quality.');
    if (![-90, 0, 90, 180].includes(next.rotation)) throw new Error('Invalid camera rotation.');
    if (!Number.isFinite(next.resultSeconds)) throw new Error('Enter a valid result reset duration.');
    next.resultSeconds = Math.max(30, Math.min(300, next.resultSeconds));
    if (!/^[\w/-]{1,128}$/.test(next.folder)) throw new Error('Use letters, numbers, slashes, underscores or hyphens for the event folder.');
    if (new URL(next.viewerUrl).protocol !== 'https:') throw new Error('Viewer URL must use HTTPS.');
    const nextEncrypted = { ...encrypted };
    for (const key of ['openAIKey', 'cloudSecret']) if (typeof incoming[key] === 'string' && incoming[key].trim()) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
      nextEncrypted[key] = safeStorage.encryptString(incoming[key].trim()).toString('base64');
    }
    if (!next.demoMode && !incoming.openAIKey?.trim() && !secret('openAIKey')) throw new Error('Add an OpenAI key before enabling live generation.');
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    const temp = `${configPath()}.tmp`;
    await fs.writeFile(temp, JSON.stringify({ settings: next, encrypted: nextEncrypted }, null, 2));
    await fs.rename(temp, configPath()); settings = next; encrypted = nextEncrypted;
    return publicSettings();
  });
  handle('printers:list', () => win.webContents.getPrintersAsync());
  handle('kiosk:enter', () => { win.setFullScreen(true); win.setKiosk(true); });
  handle('generation:cancel', () => activeController?.abort());
  handle('generation:start', async (photo, era) => {
    if (!ERA_PROMPTS[era]) throw new Error('Unknown era.');
    if (activeController) throw new Error('A photo is already being generated.');
    if (settings.demoMode) throw new Error('Preview images are prepared in the renderer.');
    if (lastEra !== era) variations[era] = 0;
    lastEra = era;
    const controller = new AbortController(); activeController = controller;
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const image = await generateImage({ photo, era, variation: variations[era] || 0, settings, key: secret('openAIKey'), signal: controller.signal });
      variations[era] = ((variations[era] || 0) + 1) % 3;
      void reportMetric(era, settings);
      return { image, demo: false };
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Generation stopped or timed out. You can retry or take a new photo.');
      throw error;
    } finally { clearTimeout(timeout); activeController = null; }
  });
  handle('photo:deliver', async (image, era, demo) => {
    if (!ERA_PROMPTS[era]) throw new Error('Unknown era.');
    if (typeof demo !== 'boolean') throw new Error('Invalid delivery mode.');
    const decoded = decodeImage(image);
    // Read the PNG IHDR dimensions so every saved/printed result matches the 1200 × 1800 contract.
    if (decoded.mime !== 'image/png' || decoded.bytes.readUInt32BE(16) !== 1200 || decoded.bytes.readUInt32BE(20) !== 1800) throw new Error('Final photo must be a 1200 × 1800 PNG.');
    const directory = demo ? path.join(photoFolder(), 'Previews') : photoFolder();
    await fs.mkdir(directory, { recursive: true });
    const filename = path.join(directory, `${new Date().toISOString().replace(/[:.]/g, '-')}-${era}-${randomUUID().slice(0, 8)}.png`);
    await fs.writeFile(filename, decoded.bytes); deliveredFiles.add(filename);
    if (demo) return { path: filename };
    try { return { path: filename, url: await uploadImage(image, settings, secret('cloudSecret')) }; }
    catch (error) { return { path: filename, warning: error.message }; }
  });
  handle('photo:upload-retry', async filename => {
    if (!deliveredFiles.has(filename) || path.dirname(filename) !== photoFolder()) throw new Error('Unknown photo.');
    const image = `data:image/png;base64,${(await fs.readFile(filename)).toString('base64')}`;
    return { url: await uploadImage(image, settings, secret('cloudSecret')) };
  });
  handle('photo:print', async image => {
    const decoded = decodeImage(image);
    if (printBusy) throw new Error('A print job is already in progress.');
    const printers = await win.webContents.getPrintersAsync();
    if (!settings.printerName || !printers.some(p => p.name === settings.printerName)) throw new Error('Select a connected photo printer in F2 settings.');
    printBusy = true;
    const printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    let timer, printDirectory;
    try {
      // High-resolution PNGs exceed Chromium's navigation URL limit when embedded in a data: HTML page.
      printDirectory = await fs.mkdtemp(path.join(app.getPath('temp'), 'ahk-print-'));
      await fs.writeFile(path.join(printDirectory, `photo.${decoded.extension}`), decoded.bytes);
      const html = `<!doctype html><html><head><style>@page{size:4in 6in;margin:0}html,body{width:4in;height:6in;margin:0;padding:0;overflow:hidden}img{display:block;width:4in;height:6in;object-fit:cover}</style></head><body><img src="photo.${decoded.extension}"></body></html>`;
      await fs.writeFile(path.join(printDirectory, 'print.html'), html);
      await printWindow.loadFile(path.join(printDirectory, 'print.html'));
      await printWindow.webContents.executeJavaScript('document.images[0].decode()');
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Printer did not respond. Ask the operator to check the queue before retrying.')), 45000);
        printWindow.webContents.print({ silent: true, printBackground: true, deviceName: settings.printerName, margins: { marginType: 'none' }, pageSize: { width: 101600, height: 152400 }, landscape: false, copies: 1 }, (ok, reason) => ok ? resolve() : reject(new Error(reason || 'Printing failed.')));
      });
    } finally {
      clearTimeout(timer); if (!printWindow.isDestroyed()) printWindow.destroy(); printBusy = false;
      if (printDirectory && path.dirname(printDirectory) === path.resolve(app.getPath('temp')) && path.basename(printDirectory).startsWith('ahk-print-')) await fs.rm(printDirectory, { recursive: true, force: true }).catch(() => {});
    }
  });
  await createWindow();
});
app.on('window-all-closed', () => { activeController?.abort(); if (process.platform !== 'darwin') app.quit(); });
