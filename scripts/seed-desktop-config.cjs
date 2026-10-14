const { app, safeStorage } = require('electron');
const path = require('node:path');
const defaults = require('../electron/default-settings.cjs');
const { seedSettings } = require('../electron/seed-settings.cjs');

const directory = path.resolve(process.argv[2] || 'release');
const profileFolder = path.join(directory, '.electron-data');
require('node:fs').mkdirSync(profileFolder, { recursive: true });
app.setPath('userData', profileFolder);

app.whenReady().then(async () => {
  const created = await seedSettings({ directory, envFile: path.resolve(process.argv[3] || '.env.local'), defaults, safeStorage, mergeExisting: true });
  console.log(created ? 'Desktop configuration initialized or missing fields filled from .env.local; portable keys saved, values omitted.' : 'Existing desktop configuration preserved.');
  app.exit(0);
}).catch(() => {
  console.error('Could not initialize desktop configuration. Check the local env settings and configuration folder. Credential values omitted.');
  app.exit(1);
});
