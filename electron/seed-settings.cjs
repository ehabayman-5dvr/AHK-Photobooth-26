const fs = require('node:fs/promises');
const path = require('node:path');
const { parseEnv } = require('node:util');

async function seedSettings({ directory, envFile, defaults, safeStorage, mergeExisting = false, bundledConfig }) {
  const filename = path.join(directory, 'operator-config.json');
  let existing;
  try { existing = JSON.parse(await fs.readFile(filename, 'utf8')); if (!mergeExisting && !existing.encrypted) return false; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let env = {};
  try { env = parseEnv(await fs.readFile(envFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const pristine = existing && !Object.keys(existing.encrypted || {}).length && !Object.keys(existing.secrets || {}).length && Object.entries(existing.settings || {}).every(([key, value]) => JSON.stringify(value) === JSON.stringify(defaults[key]));
  const settings = { ...defaults, ...bundledConfig?.settings, ...(pristine ? {} : existing?.settings) }, secrets = { ...existing?.secrets };
  const original = existing ? JSON.stringify(existing) : '';
  const fill = field => !existing || pristine || existing.settings?.[field] === undefined || existing.settings[field] === ''; 
  const fields = {
    model: 'VITE_OPENAI_MODEL', cloudName: 'VITE_CLOUDINARY_CLOUD_NAME',
    cloudKey: 'VITE_CLOUDINARY_API_KEY', folder: 'VITE_CLOUDINARY_FOLDER',
    dashboardProjectId: 'VITE_DASHBOARD_PROJECT_ID', viewerUrl: 'VITE_PHOTO_VIEWER_URL',
  };
  for (const [field, name] of Object.entries(fields)) if (env[name]?.trim() && fill(field)) settings[field] = env[name].trim();
  if (env.VITE_PREVIEW_MODE !== undefined && fill('demoMode')) settings.demoMode = env.VITE_PREVIEW_MODE !== 'false';
  if (!['gpt-image-2.5-flare', 'gpt-image-2', 'gpt-image-1.5', 'gemini-nano-banana-2.1'].includes(settings.model)) throw new Error('Unsupported image model in local env configuration.');
  if (!/^[\w/-]{1,128}$/.test(settings.folder)) throw new Error('Invalid event folder in local env configuration.');
  if (new URL(settings.viewerUrl).protocol !== 'https:') throw new Error('Viewer URL must use HTTPS.');
  const keys = { openAIKey: 'VITE_OPENAI_API_KEY', geminiKey: 'VITE_GEMINI_API_KEY', cloudSecret: 'VITE_CLOUDINARY_API_SECRET' };
  for (const [field, name] of Object.entries(keys)) {
    if (typeof secrets[field] === 'string' && secrets[field].trim()) continue;
    if (existing?.encrypted?.[field]) {
      try { secrets[field] = safeStorage?.decryptString(Buffer.from(existing.encrypted[field], 'base64')); } catch {}
    }
    if (!secrets[field] && env[name]?.trim()) secrets[field] = env[name].trim();
    if (!secrets[field] && bundledConfig?.secrets?.[field]) secrets[field] = bundledConfig.secrets[field];
  }
  const missingLegacyKeys = [...new Set([...(existing?.missingLegacyKeys || []), ...Object.keys(existing?.encrypted || {})])].filter(key => !secrets[key]);
  // Keep first-run preview enabled until the selected provider has a key.
  const key = settings.model === 'gemini-nano-banana-2.1' ? 'geminiKey' : 'openAIKey';
  if (!existing && !secrets[key]) settings.demoMode = true;
  const next = { ...existing, settings, secrets };
  delete next.encrypted;
  if (missingLegacyKeys.length) next.missingLegacyKeys = missingLegacyKeys; else delete next.missingLegacyKeys;
  if (existing && original === JSON.stringify(next)) return false;
  await fs.mkdir(directory, { recursive: true });
  if (existing) {
    const temp = `${filename}.seed.tmp`;
    await fs.writeFile(temp, JSON.stringify(next, null, 2));
    await fs.rename(temp, filename);
    return true;
  }
  try {
    await fs.writeFile(filename, JSON.stringify(next, null, 2), { flag: 'wx' });
    return true;
  } catch (error) { if (error.code === 'EEXIST') return false; throw error; }
}

module.exports = { seedSettings };
