import type { CSSProperties } from 'react';
import { asset, type Era } from './config';
import './result.css';

export default function ResultPortrait({ image, era }: { image: string; era: Era }) {
  return <div className="result-portrait" style={{ '--result-frame-mask': `url("${asset('frame.png')}")` } as CSSProperties}>
    <div className="result-portrait-art">
      <img className="final-photo" src={image} alt={`Your framed ${era.years} anniversary portrait`} data-testid="final-photo"/>
      <span className="result-frame-sheen" aria-hidden="true"/>
    </div>
  </div>;
}
