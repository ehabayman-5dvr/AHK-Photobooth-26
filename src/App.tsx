import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import Camera from './Camera';
import Loading from './Loading';
import OperatorSettings from './OperatorSettings';
import AnniversaryMark from './AnniversaryMark';
import EraPreview from './EraPreview';
import ResultPortrait from './ResultPortrait';
import { asset, defaultSettings, eras, type Era } from './config';
import { compositePhoto } from './composite';
import type { Delivery, Screen, Settings } from './types';

function Icon({ kind }: { kind: 'retake' | 'print' | 'download' }) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">{kind === 'print' ? <><path d="M13 16V5h22v11M13 33H7V17h34v16h-6M13 27h22v16H13z" stroke="currentColor" strokeWidth="3.5"/><circle cx="35" cy="22" r="2" fill="currentColor"/></> : kind === 'download' ? <><path d="M24 5v27m-9-9 9 9 9-9M7 32v10h34V32" stroke="currentColor" strokeWidth="3.5"/></> : <><path d="m13 10 4-5h14l4 5h8v32H5V10z" stroke="currentColor" strokeWidth="3"/><path d="M15 23a10 10 0 1 1 1 10m-1-10-5 2 3-6" stroke="currentColor" strokeWidth="3"/></>}</svg>;
}
export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [era, setEra] = useState<Era>(eras[0]);
  const [photo, setPhoto] = useState('');
  const [result, setResult] = useState('');
  const [qr, setQr] = useState('');
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [error, setError] = useState('');
  const [admin, setAdmin] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [printError, setPrintError] = useState('');
  const [previewLeft, setPreviewLeft] = useState(5);
  const [resultLeft, setResultLeft] = useState(90);
  const [scale, setScale] = useState(1);
  const [booted, setBooted] = useState(!window.booth);
  const runId = useRef(0), printLock = useRef(false), proceedLock = useRef(false), settingsRef = useRef(settings);
  const hotzone = useRef({ taps: 0, at: 0 });
  const fullscreenPending = useRef(false);
  const enterBrowserFullscreen = () => {
    if (admin || document.fullscreenElement || fullscreenPending.current) return;
    if (window.booth && window.booth.runtime !== 'browser-trial') return;
    if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) return;
    fullscreenPending.current = true;
    void document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .catch(() => { /* Keep the tap's normal action working if fullscreen is unavailable. */ })
      .finally(() => { fullscreenPending.current = false; });
  };
  settingsRef.current = settings;
  useEffect(() => {
    const timers = new Map<HTMLButtonElement, ReturnType<typeof setTimeout>>();
    const confirmClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button:not(.operator-hotzone)') : null;
      if (!button || button.disabled || !button.closest('.app')) return;
      clearTimeout(timers.get(button));
      button.classList.remove('button-click-feedback');
      void button.offsetWidth; // Restart the confirmation halo on repeated clicks.
      button.classList.add('button-click-feedback');
      timers.set(button, setTimeout(() => { button.classList.remove('button-click-feedback'); timers.delete(button); }, 480));
    };
    document.addEventListener('click', confirmClick, true);
    return () => { document.removeEventListener('click', confirmClick, true); timers.forEach(clearTimeout); };
  }, []);
  useEffect(() => {
    const resize = () => setScale(Math.min(innerWidth / 1080, innerHeight / 1920)); resize();
    addEventListener('resize', resize); return () => removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    void window.booth?.getSettings().then(value => { setSettings(value); setBooted(true); }).catch(() => setBooted(true));
    const key = (event: KeyboardEvent) => { if (event.key === 'F2') { event.preventDefault(); setAdmin(true); } };
    addEventListener('keydown', key);
    const off = window.booth?.onAdmin(() => setAdmin(true));
    return () => { removeEventListener('keydown', key); off?.(); };
  }, []);
  const reset = useCallback(() => {
    runId.current++; void window.booth?.cancelGeneration();
    setPhoto(''); setResult(''); setQr(''); setDelivery(null); setError(''); setPrintError(''); setDeliveryStatus('');
    setPrinted(false); setPrinting(false); printLock.current = false; proceedLock.current = false; setScreen('start');
  }, []);
  useEffect(() => {
    if (!['era', 'camera'].includes(screen) || admin) return;
    let timer = setTimeout(reset, 60000);
    const restart = () => { clearTimeout(timer); timer = setTimeout(reset, 60000); };
    addEventListener('pointerdown', restart); return () => { clearTimeout(timer); removeEventListener('pointerdown', restart); };
  }, [screen, admin, reset]);
  const startGeneration = useCallback(async () => {
    const currentRun = ++runId.current;
    setError(''); setScreen('loading'); setQr(''); setDelivery(null); setDeliveryStatus('');
    setPrintError(''); setPrinted(false); printLock.current = false;
    try {
      const config = settingsRef.current;
      let generated: string;
      if (config.demoMode) {
        await new Promise(r => setTimeout(r, 9000));
        generated = asset(`demo-${era.image}.jpg`);
      } else {
        if (!window.booth) throw new Error('Open the Electron desktop app for live image generation.');
        generated = (await window.booth.generate(photo, era.id)).image;
      }
      if (currentRun !== runId.current) return;
      const composed = await compositePhoto(generated, era);
      if (currentRun !== runId.current) return;
      setResult(composed); setResultLeft(config.resultSeconds); setScreen('result');
      setDeliveryStatus(config.demoMode ? 'Preview portrait · no QR upload' : 'Preparing your download…');
      if (window.booth) {
        try {
          const saved = await window.booth.deliver(composed, era.id, config.demoMode);
          if (currentRun !== runId.current) return;
          setDelivery(saved);
          if (saved.url) {
            const viewer = new URL(config.viewerUrl); viewer.searchParams.set('url', saved.url); viewer.searchParams.set('branded', 'true');
            const code = await QRCode.toDataURL(viewer.href, { width: 512, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#0e2549', light: '#fffaf2' } });
            if (currentRun === runId.current) { setQr(code); setDeliveryStatus('Scan to get your photo'); }
          } else setDeliveryStatus(config.demoMode ? 'Preview portrait · no QR upload' : window.booth.runtime === 'browser-trial' ? 'QR sharing unavailable · retry or ask the operator' : 'Saved locally · QR sharing unavailable');
        } catch { if (currentRun === runId.current) setDeliveryStatus('Photo delivery unavailable · please ask the operator'); }
      }
    } catch (e) { if (currentRun === runId.current) setError(e instanceof Error ? e.message : 'Could not create the portrait. Please try again.'); }
  }, [era, photo]);
  const proceed = useCallback(() => { if (proceedLock.current) return; proceedLock.current = true; void startGeneration(); }, [startGeneration]);
  const capture = useCallback((image: string) => { setPhoto(image); setPreviewLeft(5); proceedLock.current = false; setScreen('preview'); }, []);
  useEffect(() => {
    if (screen !== 'preview' || admin) return;
    const end = performance.now() + previewLeft * 1000;
    const id = setInterval(() => { const left = Math.max(0, (end - performance.now()) / 1000); setPreviewLeft(left); if (left <= 0) { clearInterval(id); proceed(); } }, 50);
    return () => clearInterval(id);
    // Keep one clock per preview entry; it is paused while operator settings are open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, admin, proceed]);
  useEffect(() => {
    if (screen !== 'result' || admin || printing) return;
    const id = setInterval(() => setResultLeft(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [screen, admin, printing]);
  useEffect(() => { if (screen === 'result' && resultLeft <= 0 && !admin && !printing) reset(); }, [screen, resultLeft, reset, admin, printing]);
  const retake = () => { runId.current++; void window.booth?.cancelGeneration(); proceedLock.current = false; setPhoto(''); setScreen('camera'); };
  const print = async () => {
    if (printLock.current || printed) return;
    printLock.current = true; setPrinting(true); setPrintError('');
    try {
      if (!window.booth) throw new Error('Printing is available in the Electron desktop app.');
      await window.booth.printPhoto(result); setPrinted(true);
    } catch (e) { setPrintError(e instanceof Error ? e.message : 'Print failed.'); printLock.current = false; }
    finally { setPrinting(false); }
  };
  const retrySharing = async () => {
    if (!window.booth || !delivery?.path) return;
    const currentRun = runId.current;
    setDeliveryStatus('Reconnecting photo sharing…');
    try {
      const uploaded = await window.booth.retryUpload(delivery.path);
      const viewer = new URL(settings.viewerUrl); viewer.searchParams.set('url', uploaded.url); viewer.searchParams.set('branded', 'true');
      const code = await QRCode.toDataURL(viewer.href, { width: 512, margin: 3, errorCorrectionLevel: 'M' });
      if (currentRun === runId.current) { setQr(code); setDeliveryStatus('Scan to get your photo'); }
    } catch { if (currentRun === runId.current) setDeliveryStatus(window.booth?.runtime === 'browser-trial' ? 'Sharing unavailable · please ask the operator' : 'Photo saved locally · ask the operator for your copy'); }
  };
  const closeAdmin = () => { setAdmin(false); void window.booth?.enterKiosk(); };
  return <main className="app" onClickCapture={enterBrowserFullscreen}>
    {!['camera', 'preview'].includes(screen) && <div className="backdrop"><video src={asset('background.mp4')} poster={asset('background.jpg')} autoPlay loop muted playsInline/><div/></div>}
    {['camera', 'preview'].includes(screen) && <div className="camera-edge-fill"/>}
    <div className="stage-wrap" style={{ width: 1080 * scale, height: 1920 * scale }}><div className="stage" style={{ transform: `scale(${scale})` }} data-screen={screen}>
    {screen === 'start' && <section className="screen start-screen"><img className="start-logo" src={asset('logo.png')} alt="AHK Egypt"/><AnniversaryMark className="start-anniversary"/><button className="start-button" aria-label="Start" disabled={!booted} onClick={() => setScreen('era')}><img src={asset('start.png')} alt="Start"/></button></section>}
    {screen === 'era' && <section className="screen era-screen" aria-label="Choose an era"><img className="era-logo" src={asset('logo.png')} alt="AHK Egypt"/><AnniversaryMark className="era-anniversary"/><img className="era-heading" src={asset('choose-era.png')} alt="Choose era · Explore 75 years of partnership"/>
      <div className="era-cards">{eras.map((choice, i) => <button key={choice.id} className="era-card" style={{ animationDelay: `${i * 130}ms` }} aria-label={`${choice.years}, ${choice.title}`} onClick={() => { setEra(choice); setScreen('camera'); }}><img className="era-card-base" src={asset(`era-card-${choice.image}.png`)} alt=""/><EraPreview image={choice.image}/></button>)}</div>
    </section>}
    {screen === 'camera' && <Camera settings={settings} era={era} onBack={() => setScreen('era')} onCapture={capture}/>}
    {screen === 'preview' && <section className="screen preview-screen" aria-label="Review your photo"><img className="preview-photo" src={photo} alt="Your captured photo"/><div className="preview-shade"/><div className="preview-controls"><p>Continuing in <strong>{Math.ceil(previewLeft)}</strong> seconds</p><div className="retake-track"><i style={{ transform: `scaleX(${previewLeft / 5})` }}/></div><button className="pill retake-button" onClick={retake}><Icon kind="retake"/>Retake</button></div></section>}
    {screen === 'loading' && <Loading era={era} error={error} onRetry={() => void startGeneration()} onRetake={retake}/>}
    {screen === 'result' && <section className="screen result-screen" aria-label="Your anniversary portrait"><h1>Your photo<span>is ready</span></h1><ResultPortrait image={result} era={era}/>
      <div className="sharing">{qr ? <div className="qr-frame"><img className="qr" src={qr} alt="Scan to download your photo"/><span className="qr-surround" aria-hidden="true"/></div> : <div className="sharing-placeholder"><span className="keepsake-stamp" aria-hidden="true">75</span><span>{settings.demoMode ? 'PREVIEW PHOTO' : 'QR CODE UNAVAILABLE'}</span></div>}<p role="status">{deliveryStatus}</p>{!qr && !settings.demoMode && delivery?.path && <button className="text-button retry-sharing" onClick={() => void retrySharing()}>Retry photo sharing</button>}</div>
      <div className="result-actions"><button onClick={reset} disabled={printing}><i><Icon kind="retake"/></i><span>New photo</span></button><button onClick={() => void print()} disabled={printing || printed}><i><Icon kind="print"/></i><span>{printing ? 'Printing…' : printed ? 'Print sent' : 'Print'}</span></button></div>
      {printError && <p className="print-error" role="alert">{printError}</p>}
      <small className="result-reset">Resetting in {resultLeft}s</small><div className="result-time-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, resultLeft / settings.resultSeconds * 100))}%` }}/></div>
    </section>}
    {settings.demoMode && <span className="preview-badge">Preview mode</span>}
    <button className="operator-hotzone" aria-label="Operator access" onClick={() => { const now = Date.now(); if (now - hotzone.current.at > 3000) hotzone.current.taps = 0; hotzone.current.at = now; if (++hotzone.current.taps >= 5) { hotzone.current.taps = 0; setAdmin(true); } }}/>
  </div></div>{admin && <OperatorSettings initial={settings} onSave={setSettings} onClose={closeAdmin}/>}</main>;
}
