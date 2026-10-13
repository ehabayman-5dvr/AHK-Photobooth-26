import { useEffect, useRef, useState } from 'react';
import type { Settings } from './types';
import { asset, ui, type Era } from './config';
import { drawCover, loadImage } from './composite';
import Gyroscope from './Gyroscope';
import './capture-button.css';

export default function Camera({ settings, era, onBack, onCapture }: { settings: Settings; era: Era; onBack: () => void; onCapture: (image: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ready = useRef(false);
  const [status, setStatus] = useState('Connecting to camera…');
  const [failed, setFailed] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const done = useRef(false);
  useEffect(() => {
    let disposed = false, stream: MediaStream | undefined, raf = 0;
    const video = document.createElement('video'); video.muted = true; video.playsInline = true;
    ready.current = false; setCameraReady(false); setFailed(false); setStatus('Connecting to camera…');
    const ctx = canvas.current!.getContext('2d')!;
    const draw = () => {
      if (disposed) return;
      const iw = video.videoWidth, ih = video.videoHeight;
      if (iw && ih) {
        ctx.save(); ctx.clearRect(0, 0, 1080, 1920); ctx.translate(540, 960);
        if (settings.mirror) ctx.scale(-1, 1);
        ctx.rotate(settings.rotation * Math.PI / 180);
        const sideways = Math.abs(settings.rotation) === 90;
        const scale = Math.max((sideways ? 1920 : 1080) / iw, (sideways ? 1080 : 1920) / ih);
        ctx.drawImage(video, -iw * scale / 2, -ih * scale / 2, iw * scale, ih * scale); ctx.restore();
        if (!ready.current) { ready.current = true; setCameraReady(true); }
      }
      raf = requestAnimationFrame(draw);
    };
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: settings.cameraId ? { exact: settings.cameraId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (disposed) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream; await video.play();
        if (disposed) return;
        setStatus('Camera ready'); draw();
      } catch {
        if (disposed) return;
        if (settings.demoMode) {
          const image = await loadImage(asset(`demo-${era.image}.jpg`));
          if (disposed) return;
          drawCover(ctx, image, image.width, image.height, 1080, 1920);
          ready.current = true; setCameraReady(true); setStatus('Preview camera · sample portrait');
        } else { setFailed(true); setStatus('Camera unavailable. Check the connection or select a camera in F2 settings.'); }
      }
    })().catch(() => { if (!disposed) { setFailed(true); setStatus('Could not open the camera preview.'); } });
    return () => { disposed = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); video.pause(); video.srcObject = null; };
  }, [settings.cameraId, settings.rotation, settings.mirror, settings.demoMode, era.image, retry]);
  useEffect(() => {
    if (count === null) return;
    const timer = setTimeout(() => {
      if (count > 1) setCount(count - 1);
      else if (!done.current) { done.current = true; onCapture(canvas.current!.toDataURL('image/jpeg', 0.95)); }
    }, 1000);
    return () => clearTimeout(timer);
  }, [count, onCapture]);
  return <section className="screen camera-screen" aria-label="Take your photo">
    <canvas ref={canvas} width={1080} height={1920} className="camera-feed" />
    <div className="camera-shade" />
    {count === null ? <>
      <button className="back-button" onClick={onBack}><img src={ui('back')} alt=""/><span>Back</span></button>
      <div className="camera-era"><span>{era.years}</span><small>{era.title}</small></div>
      <div className="camera-guides"><i/><i/><i/><i/></div>
      <div className="capture-bottom"><p role="status">{status}</p>
        {failed ? <button className="pill" onClick={() => setRetry(v => v + 1)}>Reconnect camera</button> : <button className="capture-button" aria-label="Capture photo" disabled={!cameraReady} onClick={() => { if (ready.current) { done.current = false; setCount(3); } }}>
          <span className="capture-halo" aria-hidden="true"/>
          <span className="capture-face" aria-hidden="true"><img src={ui('capture')} alt=""/><svg className="capture-symbol" viewBox="0 0 48 48" fill="none"><path d="m14 13 4-6h12l4 6h9v28H5V13z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round"/><circle cx="24" cy="27" r="8" stroke="currentColor" strokeWidth="2.8"/></svg></span>
          <span className="capture-orbit" aria-hidden="true"/>
        </button>}
        <small>Look at the camera and tap to capture</small>
      </div>
    </> : <div className="countdown"><h1>Get ready</h1><div className="countdown-orbit"><Gyroscope/><strong key={count}>{count}</strong></div><p>Look at the camera</p></div>}
  </section>;
}
