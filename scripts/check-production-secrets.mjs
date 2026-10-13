import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), '');
const secrets = ['VITE_OPENAI_API_KEY', 'VITE_CLOUDINARY_API_SECRET', 'VITE_CLOUDINARY_API_KEY']
  .map(name => ({ name, value: env[name] })).filter(entry => entry.value);
async function scan(directory) {
  for (const file of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, file.name);
    if (file.isDirectory()) { await scan(filename); continue; }
    if (!/\.(js|html|json|css)$/.test(file.name)) continue;
    const content = await fs.readFile(filename, 'utf8');
    for (const secret of secrets) if (content.includes(secret.value)) throw new Error(`${secret.name} found in production output. Credential value omitted.`);
    if (content.includes('ahk75_openai_api_key')) throw new Error('Local browser trial code found in production output.');
  }
}
await scan(path.resolve('dist'));
console.log('Production bundle excludes browser-trial code and configured env credentials.');
