import { useImageMask } from './useImageMask';
import type { CSSProperties } from 'react';
import { asset } from './config';
import './anniversary.css';

export default function AnniversaryMark({ className = '' }: { className?: string }) {
  const source = asset('anniversary.png');
  const mask = useImageMask(source);
  return <div className={`anniversary-mark ${className}`} style={{ '--anniversary-mask': mask } as CSSProperties}>
    <div className="anniversary-art">
      <img src={source} alt="75th Anniversary Gala"/>
      <span className="anniversary-sheen" aria-hidden="true"/>
      <span className="anniversary-glint glint-one" aria-hidden="true"/>
      <span className="anniversary-glint glint-two" aria-hidden="true"/>
      <span className="anniversary-glint glint-three" aria-hidden="true"/>
    </div>
  </div>;
}
