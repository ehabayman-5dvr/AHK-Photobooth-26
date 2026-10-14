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
  // The client overlay covers the edges; a 2:3 source fills this canvas without extra cropping.
  drawCover(ctx, photo, photo.naturalWidth, photo.naturalHeight, 1200, 1800);
  ctx.drawImage(frame, 0, 0, 1200, 1800);
  ctx.font = 'bold 48px Cinzel'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#102d50'; ctx.fillText(era.years, 315, 1662, 280);
  return canvas.toDataURL('image/png');
}
