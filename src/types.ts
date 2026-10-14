import type { PromptLog } from '../shared/prompt-log.mjs';
import type { FaceSummary } from '../shared/face-prompt.mjs';

export type Screen = 'start' | 'era' | 'camera' | 'preview' | 'loading' | 'result';
export interface Settings {
  demoMode: boolean; model: string; quality: 'low' | 'medium' | 'high';
  cameraId: string; rotation: number; mirror: boolean; printerName: string; printerNames?: string[]; printTopPaddingPx?: number; printBottomPaddingPx?: number;
  resultSeconds: number; cloudName: string; cloudKey: string; folder: string;
  dashboardProjectId: string; viewerUrl: string; hasOpenAIKey: boolean; hasGeminiKey?: boolean; credentialWarning?: string; hasCloudSecret: boolean;
}
export interface Generation { image: string; demo: boolean }
export interface Delivery { path: string; url?: string; warning?: string }
export interface PrinterInfo { name: string; displayName: string; state?: 'ready' | 'busy' | 'offline' | 'error' | 'unknown'; jobs?: number | null }
export interface DesktopBridge {
  runtime?: 'browser-trial' | 'electron';
  openPromptConsole?(): Promise<void>;
  onPromptLog?(callback: (details: PromptLog) => void): () => void;
  importEnvSettings?(): Promise<Settings | null>;
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings & { openAIKey?: string; geminiKey?: string; cloudSecret?: string }): Promise<Settings>;
  getPrinters(): Promise<PrinterInfo[]>;
  generate(photo: string, era: string, faces?: FaceSummary | null): Promise<Generation>;
  cancelGeneration(): Promise<void>;
  deliver(image: string, era: string, demo: boolean): Promise<Delivery>;
  retryUpload(path: string): Promise<{ url: string }>;
  printPhoto(image: string): Promise<void>;
  enterKiosk(): Promise<void>;
  onAdmin(callback: () => void): () => void;
}
declare global { interface Window { booth?: DesktopBridge } }
