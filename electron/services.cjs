const { createHash } = require('node:crypto');

const promptConfig = require('../shared/prompts.json');
const ERA_PROMPTS = promptConfig.eras;
function buildPrompt(era, variation = 0, subject = 'Preserve every visible participant. Determine people count and individual clothing presentation from the reference photo.') {
  if (!ERA_PROMPTS[era]) throw new Error('Unknown era.');
  const [scene, outfit] = ERA_PROMPTS[era][variation % ERA_PROMPTS[era].length];
  return promptConfig.template.replace('{{SCENE}}', scene).replace('{{OUTFIT}}', outfit).replace('{{SUBJECT_DESCRIPTION}}', subject);
}
function decodeImage(value) {
  if (typeof value !== 'string' || value.length > 45_000_000) throw new Error('Invalid image payload.');
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error('Expected a PNG or JPEG image.');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 16) throw new Error('Image is empty.');
  return { bytes, mime: `image/${match[1]}`, extension: match[1] === 'jpeg' ? 'jpg' : 'png' };
}
async function generateImage({ photo, era, variation, faces, onPromptLog, settings, key, signal, fetcher = fetch }) {
  const { buildSubjectDirective } = await import('../shared/face-prompt.mjs');
  const prompt = buildPrompt(era, variation, buildSubjectDirective(faces));
  const { createPromptLog, logCraftedPrompt } = await import('../shared/prompt-log.mjs');
  const logPrompt = () => {
    const details = createPromptLog({ model: settings.model, era, variation, faces, prompt, quality: settings.quality });
    logCraftedPrompt(details); onPromptLog?.(details);
  };
  if (settings.model === 'gemini-nano-banana-2.1') {
    decodeImage(photo);
    if (!key) throw new Error('Open F2 settings and add the Gemini API key, or enable preview mode.');
    logPrompt();
    const { generateGeminiImage } = await import('../shared/gemini.mjs');
    return generateGeminiImage({ photo, prompt, key, signal, fetcher });
  }
  if (!key) throw new Error('Open F2 settings and add the OpenAI API key, or enable preview mode.');
  const input = decodeImage(photo);
  const form = new FormData();
  form.append('model', settings.model);
  form.append('prompt', prompt);
  form.append('image[]', new Blob([input.bytes], { type: input.mime }), `capture.${input.extension}`);
  form.append('size', '1024x1536');
  form.append('quality', settings.quality);
  form.append('output_format', 'png');
  form.append('n', '1');
  if (settings.model === 'gpt-image-1.5') form.append('input_fidelity', 'high');
  // Image edits are deliberately not retried automatically: a retry can incur another generation charge.
  logPrompt();
  const response = await fetcher('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal });
  const data = await response.json();
  if (!response.ok) throw new Error(`Image generation (${response.status}): ${data.error?.message || 'Please try again.'}`);
  if (!data.data?.[0]?.b64_json) throw new Error('The image service returned no photo. Please try again.');
  return `data:image/png;base64,${data.data[0].b64_json}`;
}
function cloudSignature(folder, timestamp, secret) {
  return createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
}
async function uploadImage(image, settings, secret, fetcher = fetch, delay = ms => new Promise(r => setTimeout(r, ms))) {
  if (!settings.cloudName || !settings.cloudKey || !secret) throw new Error('Photo saved locally. Configure Cloudinary in F2 settings to enable QR delivery.');
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const form = new FormData();
      form.append('file', image); form.append('api_key', settings.cloudKey);
      form.append('folder', settings.folder); form.append('timestamp', timestamp);
      form.append('signature', cloudSignature(settings.folder, timestamp, secret));
      const response = await fetcher(`https://api.cloudinary.com/v1_1/${encodeURIComponent(settings.cloudName)}/image/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok || !data.secure_url) throw new Error(`Photo upload failed (${response.status}).`);
      const url = new URL(data.secure_url);
      if (url.protocol !== 'https:') throw new Error('Storage did not return a secure image URL.');
      return url.href;
    } catch (error) { lastError = error; if (attempt < 2) await delay(2000 * 2 ** attempt); }
  }
  throw lastError;
}
async function reportMetric(era, settings, fetcher = fetch) {
  if (!settings.dashboardProjectId?.trim()) return false;
  try {
    const response = await fetcher(`https://ai-photobooth-dashboard-brown.vercel.app/api/projects/${encodeURIComponent(settings.dashboardProjectId.trim())}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presetName: era, provider: settings.model === 'gemini-nano-banana-2.1' ? 'gemini' : 'openai', timestamp: Date.now() }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.info(`[Dashboard] Generation counted for project ${settings.dashboardProjectId}.`);
    return true;
  } catch (error) {
    console.warn('[Dashboard] Generation count failed:', error.message);
    return false;
  }
}
module.exports = { ERA_PROMPTS, buildPrompt, decodeImage, generateImage, cloudSignature, uploadImage, reportMetric };
