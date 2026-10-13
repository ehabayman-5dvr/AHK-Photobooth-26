export type Screen = 'start' | 'era' | 'camera' | 'preview' | 'loading' | 'result';
export interface Settings {
  demoMode: boolean; model: string; quality: 'low' | 'medium' | 'high';
  cameraId: string; rotation: number; mirror: boolean; printerName: string;
  resultSeconds: number; cloudName: string; cloudKey: string; folder: string;
  dashboardProjectId: string; viewerUrl: string; hasOpenAIKey: boolean; hasCloudSecret: boolean;
}
export interface Generation { image: string; demo: boolean }
export interface Delivery { path: string; url?: string; warning?: string }
export interface DesktopBridge {
  runtime?: 'browser-trial' | 'electron';
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings & { openAIKey?: string; cloudSecret?: string }): Promise<Settings>;
  getPrinters(): Promise<{ name: string; displayName: string }[]>;
  generate(photo: string, era: string): Promise<Generation>;
  cancelGeneration(): Promise<void>;
  deliver(image: string, era: string, demo: boolean): Promise<Delivery>;
  retryUpload(path: string): Promise<{ url: string }>;
  printPhoto(image: string): Promise<void>;
  enterKiosk(): Promise<void>;
  onAdmin(callback: () => void): () => void;
}
declare global { interface Window { booth?: DesktopBridge } }
