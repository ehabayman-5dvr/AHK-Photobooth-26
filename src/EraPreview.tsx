import { useImageMask } from './useImageMask';
import type { CSSProperties } from 'react';
import { asset } from './config';
import './era-preview.css';

export default function EraPreview({ image }: { image: number }) {
  const source = asset(`era-image-${image}.png`);
  const mask = useImageMask(source);
  return <span className="era-preview" style={{ '--era-mask': mask, '--era-phase': `${-(image - 1) * 2.8}s` } as CSSProperties} aria-hidden="true">
    <img src={source} alt=""/>
    <span className="era-preview-shimmer"/>
  </span>;
}
