export const GEMINI_IMAGE_MODEL = 'gemini-nano-banana-2.1';

// Shared by the local browser trial and Electron's main process.
export async function generateGeminiImage({ photo, prompt, key, signal, fetcher = fetch }) {
  if (!key) throw new Error('Open F2 settings and add the Gemini API key, or enable preview mode.');
  const capture = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(photo);
  if (!capture || photo.length > 45_000_000) throw new Error('Expected a captured PNG or JPEG photo.');
  // One request only: automatic retries can incur another generation charge.
  const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, signal,
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL,
      input: [{ type: 'text', text: prompt }, { type: 'image', mime_type: `image/${capture[1]}`, data: capture[2] }],
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '2:3', image_size: '1K' },
      generation_config: { thinking_level: 'minimal' },
      store: false,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Gemini image generation (${response.status}): ${data.error?.message || 'Please try again.'}`);
  const images = (data.steps || []).filter(step => step.type === 'model_output')
    .flatMap(step => step.content || []).filter(part => part.type === 'image' && part.data);
  const image = images.at(-1);
  if (!image) throw new Error('Gemini returned no photo. The request may have been blocked; retry or take a new photo.');
  if (!['image/png', 'image/jpeg'].includes(image.mime_type)) throw new Error('Gemini returned an unsupported image format.');
  return `data:${image.mime_type};base64,${image.data}`;
}
