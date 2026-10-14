import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const logo = await fs.readFile('public/assets/logo.png');
const anniversary = await fs.readFile('public/assets/anniversary.png');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const artwork = await page.evaluate(async sources => {
    const result = [];
    for (const source of sources) {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      let left = image.width, top = image.height, right = 0, bottom = 0;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        if (pixels[(y * image.width + x) * 4 + 3] > 12) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      result.push({ source, width: image.width, height: image.height, crop: `${left} ${top} ${right - left + 1} ${bottom - top + 1}` });
    }
    return result;
  }, [logo, anniversary].map(bytes => `data:image/png;base64,${bytes.toString('base64')}`));
  const place = (image, y, height) => `<svg x="40" y="${y}" width="432" height="${height}" viewBox="${image.crop}" preserveAspectRatio="xMidYMid meet"><image href="${image.source}" width="${image.width}" height="${image.height}"/></svg>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><title>AHK 75th Anniversary</title><defs><linearGradient id="navy" x2="0.8" y2="1"><stop stop-color="#173d63"/><stop offset="1" stop-color="#08182c"/></linearGradient></defs><rect x="4" y="4" width="504" height="504" rx="78" fill="url(#navy)" stroke="#c3935f" stroke-width="8"/>${place(artwork[0], 64, 196)}${place(artwork[1], 286, 180)}</svg>`;
  await fs.mkdir('public/icons', { recursive: true });
  await fs.writeFile('public/icons/app-icon.svg', svg);
  const pngs = new Map();
  for (const size of [16, 32, 48, 64, 128, 180, 192, 256, 512]) {
    const base64 = await page.evaluate(async ({ svg, size }) => {
      const image = new Image(); image.src = `data:image/svg+xml;base64,${btoa(svg)}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { svg, size });
    const bytes = Buffer.from(base64, 'base64'); pngs.set(size, bytes);
    await fs.writeFile(`public/icons/app-icon-${size}.png`, bytes);
  }
  // Windows ICO directory with embedded PNGs at native shell sizes.
  const sizes = [16, 32, 48, 64, 128, 256];
  const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16, png = pngs.get(size);
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12); offset += png.length;
  });
  await fs.writeFile('public/icons/app-icon.ico', Buffer.concat([header, ...sizes.map(size => pngs.get(size))]));
  console.log('AHK icons exported from the original brand artwork.');
} finally { await browser.close(); }
