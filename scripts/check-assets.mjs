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
console.log('Public assets verified. No generation or copying is needed.');
