import type { Settings } from './types';
export const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
export const ui = (name: string) => `${import.meta.env.BASE_URL}ui/${name}.svg`;
export const eras = [
  { id: 'foundations', years: '1951 – 1975', title: 'Building foundations', image: 1 },
  { id: 'opportunities', years: '1975 – 2001', title: 'Expanding opportunities', image: 2 },
  { id: 'tomorrow', years: '2001 – 2026', title: 'Shaping together tomorrow', image: 3 },
] as const;
export type Era = typeof eras[number];
export const defaultSettings: Settings = {
  demoMode: true, model: 'gpt-image-2', quality: 'high', cameraId: '', rotation: -90, mirror: true,
  printerName: '', resultSeconds: 90, cloudName: '', cloudKey: '', folder: 'AHK-75-Anniversary',
  dashboardProjectId: '', viewerUrl: 'https://photobooth-viewer.vercel.app/', hasOpenAIKey: false, hasCloudSecret: false,
};
