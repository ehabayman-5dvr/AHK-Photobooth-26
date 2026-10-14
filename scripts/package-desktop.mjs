import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

await import('./prepare-build-config.mjs');

const target = process.argv[2] === 'unpacked' ? ['--dir'] : ['--win', 'portable'];
const files = ['release/win-unpacked/operator-config.json'];
const backups = [];
for (const relative of files) {
  const filename = path.resolve(relative);
  try { backups.push({ filename, bytes: await fs.readFile(filename) }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const packager = spawn(process.execPath, [path.resolve('node_modules/electron-builder/out/cli/cli.js'), ...target], { stdio: 'inherit', windowsHide: true });
const code = await new Promise((resolve, reject) => { packager.on('error', reject); packager.on('exit', code => resolve(code ?? 1)); });
for (const { filename, bytes } of backups) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  try { await fs.writeFile(filename, bytes, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}
if (code === 0) {
  const expected = JSON.parse(await fs.readFile('release/build-config/operator-defaults.json', 'utf8'));
  const bundled = JSON.parse(await fs.readFile('release/win-unpacked/resources/operator-defaults.json', 'utf8'));
  if (JSON.stringify(expected.secrets) !== JSON.stringify(bundled.secrets)) throw new Error('Packaged credentials do not match the prepared env configuration. Values omitted.');
  console.log('Packaged credentials verified; values omitted.');
}
process.exitCode = code;
