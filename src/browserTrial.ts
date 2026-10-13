import { defaultSettings } from './config';
import type { DesktopBridge, Settings } from './types';
import prompts from '../shared/prompts.json';

const storageKey = 'ahk75_browser_trial_settings';
const keyStorage = 'ahk75_openai_api_key';
const cloudStorage = 'ahk75_cloudinary_api_secret';
const env = import.meta.env;
export function createBrowserTrialBridge(): DesktopBridge {
  const stored = () => { try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; } };
  const openAIKey = () => localStorage.getItem(keyStorage) || env.VITE_OPENAI_API_KEY || '';
  const cloudSecret = () => localStorage.getItem(cloudStorage) || env.VITE_CLOUDINARY_API_SECRET || '';
  let settings: Settings = {
    ...defaultSettings,
    model: env.VITE_OPENAI_MODEL || 'gpt-image-2',
    demoMode: env.VITE_PREVIEW_MODE !== 'false',
    cloudName: env.VITE_CLOUDINARY_CLOUD_NAME || '',
    cloudKey: env.VITE_CLOUDINARY_API_KEY || '',
    folder: env.VITE_CLOUDINARY_FOLDER || 'AHK-75-Anniversary',
    dashboardProjectId: env.VITE_DASHBOARD_PROJECT_ID || '',
    viewerUrl: env.VITE_PHOTO_VIEWER_URL || defaultSettings.viewerUrl,
    ...stored(),
  };
  const publicSettings = () => ({ ...settings, hasOpenAIKey: !!openAIKey(), hasCloudSecret: !!cloudSecret() });
  const photos = new Map<string, string>();
  let activeController: AbortController | undefined;
  let lastEra = '', variation = 0;

  async function upload(image: string): Promise<string> {
    if (!settings.cloudName || !settings.cloudKey || !cloudSecret()) throw new Error('Configure Cloudinary in .env.local or F2 to enable QR sharing.');
    let error: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signed = new TextEncoder().encode(`folder=${settings.folder}&timestamp=${timestamp}${cloudSecret()}`);
        const hash = await crypto.subtle.digest('SHA-1', signed);
        const signature = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
        const form = new FormData();
        form.append('file', image); form.append('api_key', settings.cloudKey);
        form.append('folder', settings.folder); form.append('timestamp', timestamp); form.append('signature', signature);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(settings.cloudName)}/image/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
        const data = await response.json();
        if (!response.ok || !data.secure_url) throw new Error(`Photo upload failed (${response.status}).`);
        const url = new URL(data.secure_url); if (url.protocol !== 'https:') throw new Error('Storage returned an invalid photo URL.');
        return url.href;
      } catch (e) { error = e; if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * 2 ** attempt)); }
    }
    throw error;
  }
  function reportMetric(era: string) {
    if (!settings.dashboardProjectId) return;
    void fetch(`https://ai-photobooth-dashboard.vercel.app/api/projects/${encodeURIComponent(settings.dashboardProjectId)}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetName: era, provider: 'openai', timestamp: Date.now() }), signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  }
  return {
    runtime: 'browser-trial',
    getSettings: async () => publicSettings(),
    saveSettings: async incoming => {
      if (!['gpt-image-2', 'gpt-image-1.5'].includes(incoming.model)) throw new Error('Unsupported image model.');
      if (!incoming.demoMode && !incoming.openAIKey?.trim() && !openAIKey()) throw new Error('Add VITE_OPENAI_API_KEY to .env.local or enter your key here.');
      if (!Number.isFinite(incoming.resultSeconds) || incoming.resultSeconds < 30 || incoming.resultSeconds > 300) throw new Error('Result reset must be between 30 and 300 seconds.');
      if (new URL(incoming.viewerUrl).protocol !== 'https:') throw new Error('Viewer URL must use HTTPS.');
      const { openAIKey: nextKey, cloudSecret: nextSecret, ...next } = incoming;
      if (nextKey?.trim()) localStorage.setItem(keyStorage, nextKey.trim());
      if (nextSecret?.trim()) localStorage.setItem(cloudStorage, nextSecret.trim());
      settings = next; localStorage.setItem(storageKey, JSON.stringify(next));
      return publicSettings();
    },
    getPrinters: async () => [],
    enterKiosk: async () => {},
    onAdmin: () => () => {},
    cancelGeneration: async () => activeController?.abort(),
    generate: async (photo, era) => {
      if (!openAIKey()) throw new Error('Add VITE_OPENAI_API_KEY to .env.local or enter the key in F2 settings.');
      if (activeController) throw new Error('A photo is already being generated.');
      const themes = prompts.eras[era as keyof typeof prompts.eras];
      if (!themes) throw new Error('Unknown era.');
      if (lastEra !== era) variation = 0; lastEra = era;
      const [scene, outfit] = themes[variation % themes.length];
      const prompt = prompts.template.replace('{{SCENE}}', scene).replace('{{OUTFIT}}', outfit);
      const controller = new AbortController(); activeController = controller;
      const timeout = setTimeout(() => controller.abort(), 180000);
      try {
        const capture = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(photo);
        if (!capture) throw new Error('Expected a captured PNG or JPEG photo.');
        const image = new Blob([Uint8Array.from(atob(capture[2]), byte => byte.charCodeAt(0))], { type: `image/${capture[1]}` });
        const form = new FormData();
        form.append('model', settings.model); form.append('prompt', prompt);
        form.append('image[]', image, image.type === 'image/png' ? 'capture.png' : 'capture.jpg');
        form.append('size', '1024x1536'); form.append('quality', settings.quality);
        form.append('output_format', 'png'); form.append('n', '1');
        if (settings.model === 'gpt-image-1.5') form.append('input_fidelity', 'high');
        const response = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${openAIKey()}` }, body: form, signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(`Image generation (${response.status}): ${data.error?.message || 'Please try again.'}`);
        if (!data.data?.[0]?.b64_json) throw new Error('The image service returned no photo.');
        variation = (variation + 1) % themes.length; reportMetric(era);
        return { image: `data:image/png;base64,${data.data[0].b64_json}`, demo: false };
      } catch (e) {
        if (controller.signal.aborted) throw new Error('Generation stopped or timed out. You can retry or take a new photo.');
        throw e;
      } finally { clearTimeout(timeout); activeController = undefined; }
    },
    deliver: async (image, _era, demo) => {
      // Browser trial keeps the current result in memory for QR delivery and upload retries.
      photos.clear(); const path = `browser:${crypto.randomUUID()}`; photos.set(path, image);
      if (demo) return { path };
      try { return { path, url: await upload(image) }; }
      catch (error) { return { path, warning: error instanceof Error ? error.message : 'Photo sharing unavailable.' }; }
    },
    retryUpload: async path => {
      const image = photos.get(path); if (!image) throw new Error('This trial photo is no longer available.');
      return { url: await upload(image) };
    },
    printPhoto: async () => { throw new Error('Printing is available in the Electron desktop app.'); },
  };
}
