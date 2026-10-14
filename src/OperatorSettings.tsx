import { useEffect, useState } from 'react';
import type { PrinterInfo, Settings } from './types';

export default function OperatorSettings({ initial, onSave, onClose }: { initial: Settings; onSave: (settings: Settings) => void; onClose: () => void }) {
  const [form, setForm] = useState(initial);
  const [openAIKey, setKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [cloudSecret, setSecret] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printerSlots, setPrinterSlots] = useState(() => {
    const names = initial.printerNames ?? (initial.printerName ? [initial.printerName] : []);
    return names.length >= 2 ? [...names] : [...names, ...Array(2 - names.length).fill('')];
  });
  const [refreshingPrinters, setRefreshingPrinters] = useState(false);
  const [printerError, setPrinterError] = useState('');
  const refreshPrinters = async () => {
    setRefreshingPrinters(true); setPrinterError('');
    try { setPrinters(await window.booth?.getPrinters() || []); }
    catch { setPrinterError('Could not read printers. Check Windows printers and refresh.'); }
    finally { setRefreshingPrinters(false); }
  };
  const movePrinter = (index: number, direction: number) => setPrinterSlots(names => {
    const next = [...names]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next;
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const browserTrial = window.booth?.runtime === 'browser-trial';
  const keyPlaceholder = browserTrial ? 'Saved for local trial · leave blank to keep' : 'Saved in local config · leave blank to keep';
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm(v => ({ ...v, [key]: value }));
  useEffect(() => {
    void navigator.mediaDevices?.enumerateDevices().then(devices => setCameras(devices.filter(d => d.kind === 'videoinput'))).catch(() => {});
    if (window.booth?.runtime !== 'browser-trial') void refreshPrinters();
  }, []);
  return <div className="modal-backdrop"><form className="operator-panel" role="dialog" aria-modal="true" aria-label="Operator settings" onSubmit={event => {
    event.preventDefault(); setSaving(true); setError('');
    void (async () => {
      try {
        if (!window.booth && !form.demoMode) throw new Error('Live generation is available in the Electron desktop app.');
        const printerNames = printerSlots.filter(Boolean);
        const saved = window.booth ? await window.booth.saveSettings({ ...form, printerNames, printerName: printerNames[0] || '', openAIKey, geminiKey, cloudSecret }) : form;
        onSave(saved); onClose();
      } catch (e) { setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '') : 'Settings could not be saved.'); }
      finally { setSaving(false); }
    })();
  }}>
    <header><div><small>5DVR · AHK 75</small><h2>Operator settings</h2></div><button type="button" aria-label="Close settings" onClick={onClose}>×</button></header>
    <p className="operator-note">{window.booth?.runtime === 'browser-trial' ? 'Local browser trial: .env.local supplies the defaults. F2 overrides are saved in this browser and do not edit the env file.' : 'F2 opens this panel. Save and return to the booth to resume kiosk mode.'} The retake allowance is fixed at 5 seconds.</p>
    {window.booth?.openPromptConsole && <button type="button" className="secondary" onClick={() => void window.booth?.openPromptConsole?.()}>Open prompt console</button>}
    {form.credentialWarning && <p role="alert" className="form-error">{form.credentialWarning}</p>}
    {window.booth?.importEnvSettings && <button type="button" disabled={saving} onClick={() => {
      setSaving(true); setError('');
      void window.booth?.importEnvSettings?.().then(saved => {
        if (saved) { setForm(saved); onSave(saved); setKey(''); setGeminiKey(''); setSecret(''); }
      }).catch(() => setError('Could not import the env file. Check its settings and try again.')).finally(() => setSaving(false));
    }}>Import .env settings</button>}
    <fieldset><legend>Experience</legend>
      <label className="checkbox"><input type="checkbox" checked={form.demoMode} onChange={e => update('demoMode', e.target.checked)}/>Preview mode · uses supplied samples, no AI request</label>
      <label>OpenAI API key<input type="password" autoComplete="off" value={openAIKey} placeholder={form.hasOpenAIKey ? keyPlaceholder : 'Add the event API key'} onChange={e => setKey(e.target.value)}/></label>
      <label>Gemini API key<input type="password" autoComplete="off" value={geminiKey} placeholder={form.hasGeminiKey ? keyPlaceholder : 'Add the Gemini API key'} onChange={e => setGeminiKey(e.target.value)}/></label>
      <div className="form-row"><label>Image model<select value={form.model} onChange={e => update('model', e.target.value)}><option value="gpt-image-2.5-flare">GPT Image 2.5 Flare</option><option>gpt-image-2</option><option>gpt-image-1.5</option><option value="gemini-nano-banana-2.1">Nano Banana 2.1 (Gemini)</option></select></label><label>Quality<select disabled={form.model === 'gemini-nano-banana-2.1'} value={form.quality} onChange={e => update('quality', e.target.value as Settings['quality'])}><option>high</option><option>medium</option><option>low</option></select></label></div>
      {form.model === 'gemini-nano-banana-2.1' && <p>Nano Banana uses 1K portrait output and minimal thinking for faster generation. Quality applies to GPT models.</p>}
    </fieldset>
    <fieldset><legend>Camera & printer</legend>
      <label>Camera<select value={form.cameraId} onChange={e => update('cameraId', e.target.value)}><option value="">System default camera</option>{cameras.map((c, i) => <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>)}</select></label>
      <div className="form-row"><label>Camera orientation<select value={form.rotation} onChange={e => update('rotation', Number(e.target.value))}><option value={-90}>−90° · sideways kiosk mount</option><option value={0}>0° · upright camera</option><option value={90}>90°</option><option value={180}>180°</option></select></label><label className="checkbox"><input type="checkbox" checked={form.mirror} onChange={e => update('mirror', e.target.checked)}/>Mirror camera</label></div>
      {browserTrial ? <p>Printing will be configured in Electron after browser approval.</p> : <div className="printer-routing">
        <p>Select the photo printers in priority order. The first ready printer receives the photo. If all are busy, it queues on the first connected printer. Offline printers and printers needing attention are skipped.</p>
        {printerSlots.map((name, index) => <div className="printer-slot" key={index}>
          <label>Photo printer {index + 1}<select value={name} onChange={e => setPrinterSlots(names => names.map((value, i) => i === index ? e.target.value : value))}>
            <option value="">Select printer</option>
            {name && !printers.some(p => p.name === name) && <option value={name}>{name} · not detected</option>}
            {printers.map(p => <option key={p.name} value={p.name} disabled={p.name !== name && printerSlots.includes(p.name)}>{p.displayName} · {p.state === 'unknown' || !p.state ? 'status unavailable' : p.state}{p.jobs != null ? ` · ${p.jobs} queued` : ''}</option>)}
          </select></label>
          <div className="printer-order-controls">
            <button type="button" aria-label={`Move printer ${index + 1} up`} disabled={index === 0} onClick={() => movePrinter(index, -1)}>↑</button>
            <button type="button" aria-label={`Move printer ${index + 1} down`} disabled={index === printerSlots.length - 1} onClick={() => movePrinter(index, 1)}>↓</button>
            <button type="button" aria-label={`Remove printer ${index + 1}`} onClick={() => setPrinterSlots(names => names.filter((_, i) => i !== index))}>Remove</button>
          </div>
        </div>)}
        <div className="printer-order-controls"><button type="button" disabled={printerSlots.length >= 20} onClick={() => setPrinterSlots(names => [...names, ''])}>Add printer</button><button type="button" disabled={refreshingPrinters} onClick={() => void refreshPrinters()}>{refreshingPrinters ? 'Checking printers…' : 'Refresh printers'}</button></div>
        {printerError && <p role="alert">{printerError}</p>}
        <div className="form-row">
          <label>Print top padding (pixels)<input type="number" min="0" max="300" step="1" value={form.printTopPaddingPx ?? 0} onChange={e => update('printTopPaddingPx', Number(e.target.value))}/></label>
          <label>Print bottom padding (pixels)<input type="number" min="0" max="300" step="1" value={form.printBottomPaddingPx ?? 0} onChange={e => update('printBottomPaddingPx', Number(e.target.value))}/></label>
        </div>
        <p>Black space above and below the printed image protects the frame from borderless cropping. Both default to 0; 60 px is about 5 mm. The image fills the full print width; only its height is compressed to make room for the padding. Saved photos and QR downloads stay unchanged.</p>
      </div>}
      <label>Result reset after (seconds)<input type="number" min="30" max="300" value={form.resultSeconds} onChange={e => update('resultSeconds', Number(e.target.value))}/></label>
    </fieldset>
    <fieldset><legend>Photo sharing</legend><p>QR delivery uploads the final framed image. {browserTrial ? 'Participants download their photo through the QR viewer.' : 'Printing and local archiving work without cloud storage.'}</p>
      <div className="form-row"><label>Cloudinary cloud name<input value={form.cloudName} onChange={e => update('cloudName', e.target.value)}/></label><label>Cloudinary API key<input value={form.cloudKey} onChange={e => update('cloudKey', e.target.value)}/></label></div>
      <label>Cloudinary secret<input type="password" autoComplete="off" value={cloudSecret} placeholder={form.hasCloudSecret ? keyPlaceholder : 'Cloudinary API secret'} onChange={e => setSecret(e.target.value)}/></label>
      <label>Event folder<input value={form.folder} onChange={e => update('folder', e.target.value)}/></label>
      <label>Photo viewer URL<input type="url" value={form.viewerUrl} onChange={e => update('viewerUrl', e.target.value)}/></label>
      <label>Dashboard project ID (optional)<input value={form.dashboardProjectId} onChange={e => update('dashboardProjectId', e.target.value)} placeholder="AHK event project UUID"/></label>
    </fieldset>
    {error && <p role="alert" className="form-error">{error}</p>}
    <footer><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save & return to booth'}</button></footer>
  </form></div>;
}
