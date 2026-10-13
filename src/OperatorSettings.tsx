import { useEffect, useState } from 'react';
import type { Settings } from './types';

export default function OperatorSettings({ initial, onSave, onClose }: { initial: Settings; onSave: (settings: Settings) => void; onClose: () => void }) {
  const [form, setForm] = useState(initial);
  const [openAIKey, setKey] = useState('');
  const [cloudSecret, setSecret] = useState('');
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [printers, setPrinters] = useState<{ name: string; displayName: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const browserTrial = window.booth?.runtime === 'browser-trial';
  const keyPlaceholder = browserTrial ? 'Saved for local trial · leave blank to keep' : 'Stored securely · leave blank to keep';
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm(v => ({ ...v, [key]: value }));
  useEffect(() => {
    void navigator.mediaDevices?.enumerateDevices().then(devices => setCameras(devices.filter(d => d.kind === 'videoinput'))).catch(() => {});
    void window.booth?.getPrinters().then(setPrinters).catch(() => {});
  }, []);
  return <div className="modal-backdrop"><form className="operator-panel" role="dialog" aria-modal="true" aria-label="Operator settings" onSubmit={event => {
    event.preventDefault(); setSaving(true); setError('');
    void (async () => {
      try {
        if (!window.booth && !form.demoMode) throw new Error('Live generation is available in the Electron desktop app.');
        const saved = window.booth ? await window.booth.saveSettings({ ...form, openAIKey, cloudSecret }) : form;
        onSave(saved); onClose();
      } catch (e) { setError(e instanceof Error ? e.message : 'Settings could not be saved.'); }
      finally { setSaving(false); }
    })();
  }}>
    <header><div><small>5DVR · AHK 75</small><h2>Operator settings</h2></div><button type="button" aria-label="Close settings" onClick={onClose}>×</button></header>
    <p className="operator-note">{window.booth?.runtime === 'browser-trial' ? 'Local browser trial: .env.local supplies the defaults. F2 overrides are saved in this browser and do not edit the env file.' : 'F2 opens this panel. Save and return to the booth to resume kiosk mode.'} The retake allowance is fixed at 5 seconds.</p>
    <fieldset><legend>Experience</legend>
      <label className="checkbox"><input type="checkbox" checked={form.demoMode} onChange={e => update('demoMode', e.target.checked)}/>Preview mode · uses supplied samples, no AI request</label>
      <label>OpenAI API key<input type="password" autoComplete="off" value={openAIKey} placeholder={initial.hasOpenAIKey ? keyPlaceholder : 'Add the event API key'} onChange={e => setKey(e.target.value)}/></label>
      <div className="form-row"><label>Image model<select value={form.model} onChange={e => update('model', e.target.value)}><option>gpt-image-2</option><option>gpt-image-1.5</option></select></label><label>Quality<select value={form.quality} onChange={e => update('quality', e.target.value as Settings['quality'])}><option>high</option><option>medium</option><option>low</option></select></label></div>
    </fieldset>
    <fieldset><legend>Camera & printer</legend>
      <label>Camera<select value={form.cameraId} onChange={e => update('cameraId', e.target.value)}><option value="">System default camera</option>{cameras.map((c, i) => <option key={c.deviceId || i} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>)}</select></label>
      <div className="form-row"><label>Camera orientation<select value={form.rotation} onChange={e => update('rotation', Number(e.target.value))}><option value={-90}>−90° · sideways kiosk mount</option><option value={0}>0° · upright camera</option><option value={90}>90°</option><option value={180}>180°</option></select></label><label className="checkbox"><input type="checkbox" checked={form.mirror} onChange={e => update('mirror', e.target.checked)}/>Mirror camera</label></div>
      {browserTrial ? <p>Printing will be configured in Electron after browser approval.</p> : <label>4 × 6 borderless photo printer<select value={form.printerName} onChange={e => update('printerName', e.target.value)}><option value="">Select printer</option>{printers.map(p => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}</select></label>}
      <label>Result reset after (seconds)<input type="number" min="30" max="300" value={form.resultSeconds} onChange={e => update('resultSeconds', Number(e.target.value))}/></label>
    </fieldset>
    <fieldset><legend>Photo sharing</legend><p>QR delivery uploads the final framed image. {browserTrial ? 'Participants download their photo through the QR viewer.' : 'Printing and local archiving work without cloud storage.'}</p>
      <div className="form-row"><label>Cloudinary cloud name<input value={form.cloudName} onChange={e => update('cloudName', e.target.value)}/></label><label>Cloudinary API key<input value={form.cloudKey} onChange={e => update('cloudKey', e.target.value)}/></label></div>
      <label>Cloudinary secret<input type="password" autoComplete="off" value={cloudSecret} placeholder={initial.hasCloudSecret ? keyPlaceholder : 'Cloudinary API secret'} onChange={e => setSecret(e.target.value)}/></label>
      <label>Event folder<input value={form.folder} onChange={e => update('folder', e.target.value)}/></label>
      <label>Photo viewer URL<input type="url" value={form.viewerUrl} onChange={e => update('viewerUrl', e.target.value)}/></label>
      <label>Dashboard project ID (optional)<input value={form.dashboardProjectId} onChange={e => update('dashboardProjectId', e.target.value)} placeholder="AHK event project UUID"/></label>
    </fieldset>
    {error && <p role="alert" className="form-error">{error}</p>}
    <footer><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save & return to booth'}</button></footer>
  </form></div>;
}
