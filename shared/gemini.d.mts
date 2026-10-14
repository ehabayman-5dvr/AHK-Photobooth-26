export const GEMINI_IMAGE_MODEL: 'gemini-nano-banana-2.1';
export function generateGeminiImage(options: {
  photo: string; prompt: string; key: string; signal?: AbortSignal; fetcher?: typeof fetch;
}): Promise<string>;
