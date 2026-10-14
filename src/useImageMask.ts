import { useEffect, useState } from 'react';

const masks = new Map<string, Promise<string>>();
export function useImageMask(source: string): string {
  const [mask, setMask] = useState('linear-gradient(transparent, transparent)');
  useEffect(() => {
    let active = true;
    if (!masks.has(source)) masks.set(source, (async () => {
      const response = await fetch(source);
      if (!response.ok) throw new Error('Mask asset could not be loaded.');
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(`url("${reader.result}")`);
        reader.onerror = () => reject(new Error('Mask asset could not be read.'));
        reader.readAsDataURL(blob);
      });
    })());
    void masks.get(source)!.then(value => { if (active) setMask(value); }).catch(() => {});
    return () => { active = false; };
  }, [source]);
  return mask;
}
