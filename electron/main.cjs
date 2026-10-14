const { app, BrowserWindow, ipcMain, session, safeStorage, Menu, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { ERA_PROMPTS, decodeImage, generateImage, uploadImage, reportMetric } = require('./services.cjs');
const printerRouting = require('./printer-routing.cjs');
const { settingsDirectory } = require('./settings-path.cjs');

// Isolated folders for automated desktop integration checks, disabled in packaged builds.
const testing = !app.isPackaged && !!process.env.AHK_TEST_USER_DATA;
const settingsFolder = settingsDirectory({
  packaged: app.isPackaged,
  portableDirectory: process.env.PORTABLE_EXECUTABLE_DIR,
  executablePath: app.getPath('exe'),
  projectDirectory: path.resolve(__dirname, '..'),
  testDirectory: testing ? process.env.AHK_TEST_USER_DATA : undefined,
});

// Keep Chromium runtime data beside the desktop build.
const profileFolder = path.join(settingsFolder, '.electron-data');
require('node:fs').mkdirSync(profileFolder, { recursive: true });
app.setPath('userData', profileFolder);

const defaults = require('./default-settings.cjs');
const { seedSettings } = require('./seed-settings.cjs');
let win, settings = { ...defaults }, credentials = {}, missingLegacyKeys = [], activeController, printBusy = false;
let lastEra, variations = {}, deliveredFiles = new Set();
const devUrl = process.env.AHK_DEV_URL;
const configPath = () => path.join(settingsFolder, 'operator-config.json');
const photoFolder = () => testing ? path.join(app.getPath('userData'), 'Photos') : path.join(app.getPath('pictures'), 'AHK-75-Photobooth');
const secret = key => {
  if (key === 'geminiKey' && process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (key === 'openAIKey' && process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  return typeof credentials[key] === 'string' ? credentials[key] : '';
};
const unreadableKeys = () => missingLegacyKeys.filter(key => !secret(key));
const publicSettings = () => ({ ...settings, hasOpenAIKey: !!secret('openAIKey'), hasGeminiKey: !!secret('geminiKey'), hasCloudSecret: !!secret('cloudSecret'),
  credentialWarning: unreadableKeys().length ? 'Legacy encrypted keys could not be recovered. Import the original .env.local file or re-enter the keys below. Settings and printer selections are preserved.' : '' });
async function readSettings() {
  const stored = JSON.parse(await fs.readFile(configPath(), 'utf8'));
  settings = { ...defaults, ...stored.settings };
  settings.printerNames = printerRouting.normalizePrinterNames(stored.settings?.printerNames, stored.settings?.printerName);
  settings.printerName = settings.printerNames[0] || '';
  credentials = stored.secrets || {};
  missingLegacyKeys = stored.missingLegacyKeys || [];
  const imageKey = settings.model === 'gemini-nano-banana-2.1' ? 'geminiKey' : 'openAIKey';
  if (missingLegacyKeys.includes(imageKey) && !secret(imageKey)) settings.demoMode = true;
}
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
  let bundledConfig;
  if (app.isPackaged) {
    try { bundledConfig = JSON.parse(await fs.readFile(path.join(process.resourcesPath, 'operator-defaults.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await seedSettings({ directory: settingsFolder, envFile: path.join(settingsFolder, '.env.local'), defaults, safeStorage, mergeExisting: true, bundledConfig });
  try {
    await readSettings();
  } catch { /* First run uses preview mode. */ }
  win = new BrowserWindow({ icon: path.join(__dirname, '../dist/icons/app-icon-512.png'), width: 1080, height: 1920, useContentSize: true, minWidth: 480, minHeight: 700, backgroundColor: '#08182c',
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
  handle('settings:import-env', async () => {
    const selected = await dialog.showOpenDialog(win, { title: 'Import photobooth environment settings', properties: ['openFile', 'showHiddenFiles'] });
    if (selected.canceled || !selected.filePaths[0]) return null;
    await seedSettings({ directory: settingsFolder, envFile: selected.filePaths[0], defaults, safeStorage, mergeExisting: true });
    await readSettings();
    return publicSettings();
  });
  handle('settings:save', async incoming => {
    const next = {};
    for (const [key, value] of Object.entries(defaults)) next[key] = typeof incoming[key] === typeof value ? incoming[key] : settings[key];
    next.printerNames = printerRouting.normalizePrinterNames(incoming.printerNames, incoming.printerName ?? settings.printerName);
    next.printerName = next.printerNames[0] || '';
    if (!['gemini-nano-banana-2.1', 'gpt-image-2.5-flare', 'gpt-image-2', 'gpt-image-1.5'].includes(next.model)) throw new Error('Unsupported image model.');
    if (!['low', 'medium', 'high'].includes(next.quality)) throw new Error('Invalid image quality.');
    if (![-90, 0, 90, 180].includes(next.rotation)) throw new Error('Invalid camera rotation.');
    if (!Number.isInteger(next.printTopPaddingPx) || next.printTopPaddingPx < 0 || next.printTopPaddingPx > 300) throw new Error('Print top padding must be 0 to 300 pixels.');
    if (!Number.isInteger(next.printBottomPaddingPx) || next.printBottomPaddingPx < 0 || next.printBottomPaddingPx > 300) throw new Error('Print bottom padding must be 0 to 300 pixels.');
    if (!Number.isFinite(next.resultSeconds)) throw new Error('Enter a valid result reset duration.');
    next.resultSeconds = Math.max(30, Math.min(300, next.resultSeconds));
    if (!/^[\w/-]{1,128}$/.test(next.folder)) throw new Error('Use letters, numbers, slashes, underscores or hyphens for the event folder.');
    if (new URL(next.viewerUrl).protocol !== 'https:') throw new Error('Viewer URL must use HTTPS.');
    const nextCredentials = { ...credentials };
    for (const key of ['openAIKey', 'geminiKey', 'cloudSecret']) if (typeof incoming[key] === 'string' && incoming[key].trim()) {
      nextCredentials[key] = incoming[key].trim();
    }
    const imageKey = next.model === 'gemini-nano-banana-2.1' ? 'geminiKey' : 'openAIKey';
    if (!next.demoMode && !incoming[imageKey]?.trim() && !secret(imageKey)) throw new Error(`Add a ${imageKey === 'geminiKey' ? 'Gemini' : 'OpenAI'} key before enabling live generation.`);
    await fs.mkdir(settingsFolder, { recursive: true });
    const temp = `${configPath()}.tmp`;
    await fs.writeFile(temp, JSON.stringify({ settings: next, secrets: nextCredentials }, null, 2));
    await fs.rename(temp, configPath()); settings = next; credentials = nextCredentials; missingLegacyKeys = [];
    return publicSettings();
  });
  handle('prompt:console', () => win.webContents.openDevTools({ mode: 'detach' }));
  handle('printers:list', () => printerRouting.listPrinters(win.webContents));
  handle('kiosk:enter', () => { win.setFullScreen(true); win.setKiosk(true); });
  handle('generation:cancel', () => activeController?.abort());
  handle('generation:start', async (photo, era, faces) => {
    if (!ERA_PROMPTS[era]) throw new Error('Unknown era.');
    if (activeController) throw new Error('A photo is already being generated.');
    if (settings.demoMode) throw new Error('Preview images are prepared in the renderer.');
    if (lastEra !== era) variations[era] = 0;
    lastEra = era;
    const controller = new AbortController(); activeController = controller;
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const image = await generateImage({ photo, era, faces, onPromptLog: details => win.webContents.send('prompt:log', details), variation: variations[era] || 0, settings, key: secret(settings.model === 'gemini-nano-banana-2.1' ? 'geminiKey' : 'openAIKey'), signal: controller.signal });
      variations[era] = ((variations[era] || 0) + 1) % ERA_PROMPTS[era].length;
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
    printBusy = true;
    let timer, printDirectory, printWindow;
    const topPadding = Number.isInteger(settings.printTopPaddingPx) && settings.printTopPaddingPx >= 0 && settings.printTopPaddingPx <= 300 ? settings.printTopPaddingPx : defaults.printTopPaddingPx;
    const bottomPadding = Number.isInteger(settings.printBottomPaddingPx) && settings.printBottomPaddingPx >= 0 && settings.printBottomPaddingPx <= 300 ? settings.printBottomPaddingPx : defaults.printBottomPaddingPx;
    try {
      const printers = await printerRouting.listPrinters(win.webContents);
      const route = printerRouting.choosePrinter(settings.printerNames, printers);
      const deviceName = route.printer.name;
      console.log(`[Photo print] ${deviceName} | ${route.reason} | queued jobs: ${route.printer.jobs ?? 'unknown'}`);
      printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
      // High-resolution PNGs exceed Chromium's navigation URL limit when embedded in a data: HTML page.
      printDirectory = await fs.mkdtemp(path.join(app.getPath('temp'), 'ahk-print-'));
      await fs.writeFile(path.join(printDirectory, `photo.${decoded.extension}`), decoded.bytes);
      const html = `<!doctype html><html><head><style>@page{size:4in 6in;margin:0}html,body{width:4in;height:6in;margin:0;padding:0;overflow:hidden}canvas{display:block;width:4in;height:6in}img{display:none}</style></head><body><canvas width="1200" height="1800"></canvas><img src="photo.${decoded.extension}"></body></html>`;
      await fs.writeFile(path.join(printDirectory, 'print.html'), html);
      await printWindow.loadFile(path.join(printDirectory, 'print.html'));
      await printWindow.webContents.executeJavaScript(`document.images[0].decode().then(() => {
        const image = document.images[0], canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1200, 1800);
        const height = 1800 - ${topPadding} - ${bottomPadding};
        ctx.drawImage(image, 0, ${topPadding}, 1200, height);
      })`);
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Printer did not respond. Ask the operator to check the queue before retrying.')), 45000);
        printWindow.webContents.print({ silent: true, printBackground: true, deviceName, margins: { marginType: 'none' }, pageSize: { width: 101600, height: 152400 }, landscape: false, copies: 1 }, (ok, reason) => ok ? resolve() : reject(new Error(reason || 'Printing failed.')));
      });
    } finally {
      clearTimeout(timer); if (printWindow && !printWindow.isDestroyed()) printWindow.destroy(); printBusy = false;
      if (printDirectory && path.dirname(printDirectory) === path.resolve(app.getPath('temp')) && path.basename(printDirectory).startsWith('ahk-print-')) await fs.rm(printDirectory, { recursive: true, force: true }).catch(() => {});
    }
  });
  await createWindow();
});
app.on('window-all-closed', () => { activeController?.abort(); if (process.platform !== 'darwin') app.quit(); });
