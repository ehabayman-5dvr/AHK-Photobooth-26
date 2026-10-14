import { summarizeFaces, type FaceSummary } from '../shared/face-prompt.mjs';

let loading: Promise<typeof import('face-api.js')> | undefined;
export function loadFaceModels() {
  return loading ??= (async () => {
    const faceapi = await import('face-api.js');
    faceapi.env.monkeyPatch({
      Canvas: HTMLCanvasElement, Image: HTMLImageElement,
      fetch: window.fetch.bind(window),
      createCanvasElement: () => document.createElement('canvas'),
      createImageElement: () => document.createElement('img'),
    });
    try { await faceapi.tf.setBackend('webgl'); await faceapi.tf.ready(); }
    catch { await faceapi.tf.setBackend('cpu'); await faceapi.tf.ready(); }
    const directory = new URL(`${import.meta.env.BASE_URL}models/`, location.href).href;
    // The kiosk carries its own weights; no remote model downloads.
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(directory),
      faceapi.nets.faceLandmark68Net.loadFromUri(directory),
      faceapi.nets.ageGenderNet.loadFromUri(directory),
    ]);
    return faceapi;
  })();
}

let active: Promise<FaceSummary | null> | undefined;
export async function analyzePhoto(photo: string): Promise<FaceSummary | null> {
  // Do not overlap expensive inference after retakes or timeouts.
  if (active) return null;
  const task = (async () => {
    const faceapi = await loadFaceModels();
    const image = new Image(); image.src = photo; await image.decode();
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Capture already includes the configured rotation and mirror transform.
    const faces = await faceapi.detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks().withAgeAndGender();
    return summarizeFaces(faces);
  })().catch(() => null);
  active = task;
  void task.finally(() => { if (active === task) active = undefined; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 8000); })]);
  } finally { clearTimeout(timer); }
}
