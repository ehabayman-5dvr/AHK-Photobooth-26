import { useEffect, useState } from 'react';
import { asset, type Era } from './config';
import Gyroscope from './Gyroscope';
import AnniversaryMark from './AnniversaryMark';

export default function Loading({ era, error, onRetry, onRetake }: { era: Era; error: string; onRetry: () => void; onRetake: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [touch, setTouch] = useState({ x: 0, y: 0 });
  useEffect(() => { const id = setInterval(() => setElapsed(v => v + 1), 1000); return () => clearInterval(id); }, []);
  return <section className="screen loading-screen" aria-label="Creating your portrait" onPointerMove={e => {
    const r = e.currentTarget.getBoundingClientRect(); setTouch({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
  }}>
    <div className="loading-veil"/><header className="loading-brand"><img src={asset('logo.png')} alt="AHK Egypt"/><AnniversaryMark/></header>
    <div className="time-portal" style={{ transform: `translate(${touch.x * 18}px, ${touch.y * 14}px)` }}>
      <div className="portal-halo"/><div className="portal-dial"/><Gyroscope portal/>
      <div className="portal-memories" aria-hidden="true">{[1, 2, 3].map(i => <img key={i} src={asset(`era-image-${i}.png`)} alt=""/>)}</div>
      <div className="portal-center"><small>SELECTED ERA</small><strong>{era.years.split(' – ')[0]}</strong><span>{era.title}</span></div>
      <div className="portal-years"><span>1951</span><span>1975</span><span>2001</span><span>2026</span></div>
    </div>
    <div className="loading-copy">
      <h1>{error ? 'Unable to process photo' : 'Processing photo'}</h1>
      <p role="status">{error || 'Please wait.'}</p>
      {!error && <><div className="loading-track"><i style={{ width: `${Math.min(92, 12 + 80 * (1 - Math.exp(-elapsed / 30)))}%` }}/></div><button className="text-button loading-cancel" onClick={onRetake}>Cancel</button></>}
      {error && <div className="error-actions"><button className="pill" onClick={onRetry}>Try again</button><button className="text-button" onClick={onRetake}>Take a new photo</button></div>}
    </div>
  </section>;
}
