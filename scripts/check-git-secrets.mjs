import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const sensitiveName = /(?:API_?(?:KEY|SECRET)|TOKEN|PASSWORD|PRIVATE_?KEY)$/i;
const tokenPatterns = [
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/,
  /\bAIza[A-Za-z0-9_-]{30,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

export function inspectFile(filename, bytes, knownSecrets = []) {
  const base = path.posix.basename(filename.replaceAll('\\', '/'));
  const reasons = [];
  if ((/^\.env/i.test(base) && base !== '.env.example') || /^\.npmrc$/i.test(base) || /^(?:operator-config|printer-config|credentials|secrets)\.json/i.test(base) || /\.(?:pem|key|p12|pfx|keystore|jks)$/i.test(base)) reasons.push('local credential/configuration file');
  const text = bytes.toString('utf8');
  if (tokenPatterns.some(pattern => pattern.test(text))) reasons.push('recognizable token or private key');
  if (knownSecrets.some(value => value.length >= 8 && bytes.includes(Buffer.from(value)))) reasons.push('credential matching local env configuration');
  if (base === '.env.example') {
    try {
      if (Object.entries(parseEnv(text)).some(([name, value]) => sensitiveName.test(name) && value.trim())) reasons.push('credential fields in .env.example must be blank');
    } catch { reasons.push('invalid env template'); }
  }
  return reasons;
}

function localSecrets() {
  const values = [];
  for (const filename of fs.readdirSync('.').filter(name => /^\.env/i.test(name) && fs.statSync(name).isFile())) {
    try {
      for (const [name, value] of Object.entries(parseEnv(fs.readFileSync(filename, 'utf8')))) if (sensitiveName.test(name) && value) values.push(value);
    } catch { /* Non-env backup formats are still blocked by filename. */ }
  }
  for (const [name, value] of Object.entries(process.env)) if (sensitiveName.test(name) && value) values.push(value);
  return [...new Set(values)];
}

function git(args, binary = false) {
  return execFileSync('git', args, { encoding: binary ? undefined : 'utf8', maxBuffer: 100 * 1024 * 1024 });
}

export function auditGit({ working = false } = {}) {
  const secrets = localSecrets();
  const entries = git(['ls-files', '--stage', '-z']).split('\0').filter(Boolean);
  const candidates = new Map();
  for (const entry of entries) {
    const match = /^(\d+) ([a-f0-9]+) [0-3]\t([\s\S]+)$/.exec(entry);
    if (match && match[1] !== '160000') candidates.set(match[3], git(['cat-file', 'blob', match[2]], true));
  }
  if (working) {
    for (const filename of git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) {
      if (fs.existsSync(filename) && fs.statSync(filename).isFile()) candidates.set(filename, fs.readFileSync(filename));
    }
  }
  const issues = [];
  for (const [filename, bytes] of candidates) {
    const reasons = inspectFile(filename, bytes, secrets);
    if (reasons.length) issues.push({ filename, reasons });
  }
  return { files: candidates.size, issues };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditGit({ working: process.argv.includes('--working') });
  if (result.issues.length) {
    console.error('Commit blocked: possible credentials found. Values are omitted.');
    for (const issue of result.issues) console.error(`${issue.filename}: ${issue.reasons.join('; ')}`);
    process.exitCode = 1;
  } else console.log(`Credential check passed (${result.files} files; values not displayed).`);
}
