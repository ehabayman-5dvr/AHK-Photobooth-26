import { asset, type Era } from './config';

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}
export function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource, iw: number, ih: number, width: number, height: number) {
  const scale = Math.max(width / iw, height / ih);
  ctx.drawImage(image, (width - iw * scale) / 2, (height - ih * scale) / 2, iw * scale, ih * scale);
}
export async function compositePhoto(src: string, era: Era): Promise<string> {
  const [photo, frame] = await Promise.all([loadImage(src), loadImage(asset('frame.png'))]);
  await document.fonts.load('bold 58px Cinzel');
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 1800;
  const ctx = canvas.getContext('2d')!;
  drawCover(ctx, photo, photo.naturalWidth, photo.naturalHeight, 1200, 1800);
  ctx.drawImage(frame, 0, 0, 1200, 1800);
  // The source frame has its first era baked into the left plaque. Keep its border and update only the inset.
  if (era.id !== 'foundations') {
    const plate = ctx.createLinearGradient(0, 1668, 0, 1770);
    plate.addColorStop(0, '#1b2b3c'); plate.addColorStop(1, '#0e1927');
    ctx.fillStyle = plate; ctx.beginPath(); ctx.roundRect(215, 1668, 372, 102, 18); ctx.fill();
    ctx.font = '58px Cinzel'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#e7bc8e'; ctx.lineWidth = 1.5; ctx.strokeText(era.years, 400, 1720, 350);
    ctx.fillStyle = '#152b40'; ctx.fillText(era.years, 400, 1720, 350);
  }
  return canvas.toDataURL('image/png');
}
