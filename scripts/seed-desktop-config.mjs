import { spawn } from 'node:child_process';
import electron from 'electron';
import path from 'node:path';

const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [path.resolve('scripts/seed-desktop-config.cjs'), process.argv[2] || 'release', process.argv[3] || '.env.local'], { env, stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('Could not start desktop configuration initialization.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
