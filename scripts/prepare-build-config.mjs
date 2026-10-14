import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import defaults from '../electron/default-settings.cjs';
import seeding from '../electron/seed-settings.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
const env = parseEnv(await fs.readFile(envFile, 'utf8'));
const directory = path.join(root, 'release/build-config');
await fs.mkdir(path.join(root, 'release'), { recursive: true });
// Prepare a fresh template every build, so stale output cannot hide updated env keys.
const temp = await fs.mkdtemp(path.join(root, 'release/config-stage-'));
await seeding.seedSettings({ directory: temp, envFile, defaults });
const config = JSON.parse(await fs.readFile(path.join(temp, 'operator-config.json'), 'utf8'));
const fields = { openAIKey: 'VITE_OPENAI_API_KEY', geminiKey: 'VITE_GEMINI_API_KEY', cloudSecret: 'VITE_CLOUDINARY_API_SECRET' };
for (const [key, name] of Object.entries(fields)) {
  if (env[name]?.trim() && config.secrets[key] !== env[name].trim()) throw new Error(`Build configuration did not import ${name}. Credential values omitted.`);
}
const imageKey = config.settings.model === 'gemini-nano-banana-2.1' ? 'geminiKey' : 'openAIKey';
if (!config.secrets[imageKey]) throw new Error('Build requires the selected image provider key in project-root .env.local.');
await fs.mkdir(directory, { recursive: true });
await fs.writeFile(path.join(directory, 'operator-defaults.json'), JSON.stringify(config, null, 2));
console.log('Bundled desktop configuration prepared and verified against .env.local; credential values omitted.');
