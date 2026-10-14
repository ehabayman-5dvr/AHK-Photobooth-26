export function createPromptLog({ model, era, variation = 0, faces, prompt, quality }) {
  const counts = {};
  for (const key of ['totalPeople', 'maleCount', 'femaleCount', 'childCount', 'unknownCount']) {
    if (Number.isInteger(faces?.[key]) && faces[key] >= 0) counts[key] = faces[key];
  }
  return {
    timestamp: new Date().toISOString(), model, era, variation: variation + 1,
    output: model === 'gemini-nano-banana-2.1' ? 'JPEG · 2:3 · 1K · minimal thinking' : `PNG · 1024x1536 · quality ${quality || 'high'}`,
    faces: Object.keys(counts).length === 5 ? counts : null, prompt,
  };
}

export function logCraftedPrompt(details, logger = console, mode = typeof window === 'undefined' ? 'terminal' : 'browser') {
  const title = `PHOTOBOOTH PROMPT · ${details.model} · ${details.era} · variation ${details.variation}`;
  const counts = details.faces ? JSON.stringify(details.faces) : 'Unavailable / no faces detected; reference-photo fallback';
  if (mode === 'browser') {
    logger.group(`%c${title}`, 'background:#173b60;color:#fff;padding:6px 10px;font-weight:bold');
    logger.log('%cRequest', 'color:#22b8cf;font-weight:bold', details.timestamp, details.output);
    logger.log('%cPeople analysis', 'color:#e6a23c;font-weight:bold', counts);
    logger.log('%cFinal prompt (exact text sent)', 'color:#36b37e;font-weight:bold');
    logger.log('%s', details.prompt);
    logger.groupEnd();
  } else {
    logger.log(`\x1b[1;36m${title}\x1b[0m`);
    logger.log(`\x1b[36mRequest:\x1b[0m ${details.timestamp} · ${details.output}`);
    logger.log(`\x1b[33mPeople analysis:\x1b[0m ${counts}`);
    logger.log('\x1b[1;32mFinal prompt (exact text sent):\x1b[0m');
    logger.log('%s', details.prompt);
    logger.log('\x1b[36mEND PHOTOBOOTH PROMPT\x1b[0m');
  }
}
