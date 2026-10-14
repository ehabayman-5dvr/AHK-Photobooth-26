import fs from 'node:fs/promises';
import path from 'node:path';

const assets = [
  'background.mp4', 'background.jpg', 'logo.png', 'anniversary.png', 'start.png', 'choose-era.png', 'frame.png',
  'Cinzel-Regular.ttf', 'Cinzel-Bold.ttf', 'CormorantGaramond-SemiBold.ttf', 'CormorantGaramond-Bold.ttf',
  'KaiseiHarunoUmi-Regular.ttf', 'KaiseiHarunoUmi-Bold.ttf',
  ...[1, 2, 3].flatMap(i => [`era-card-${i}.png`, `era-image-${i}.png`, `demo-${i}.jpg`]),
];
for (const name of assets) await fs.access(path.resolve('public/assets', name));
for (const name of ['back.svg', 'capture.svg']) await fs.access(path.resolve('public/ui', name));
for (const model of ['ssd_mobilenetv1', 'face_landmark_68', 'age_gender']) {
  const manifest = JSON.parse(await fs.readFile(path.resolve('public/models', `${model}_model-weights_manifest.json`), 'utf8'));
  for (const group of manifest) for (const shard of group.paths) {
    const filename = path.resolve('public/models', shard);
    if (path.dirname(filename) !== path.resolve('public/models')) throw new Error('Invalid model shard path.');
    if ((await fs.stat(filename)).size === 0) throw new Error(`Empty face model shard: ${shard}`);
  }
}
for (const name of ['app-icon.svg', 'app-icon.ico', 'app-icon-180.png', 'app-icon-192.png', 'app-icon-512.png']) await fs.access(path.resolve('public/icons', name));
await fs.access(path.resolve('public/manifest.webmanifest'));
console.log('Public assets verified. No generation or copying is needed.');
