import type { FaceSummary } from './face-prompt.mjs';
export interface PromptLog {
  timestamp: string; model: string; era: string; variation: number; output: string;
  faces: FaceSummary | null; prompt: string;
}
export function createPromptLog(options: { model: string; era: string; variation?: number; faces?: FaceSummary | null; prompt: string; quality?: string }): PromptLog;
export function logCraftedPrompt(details: PromptLog, logger?: Console, mode?: 'terminal' | 'browser'): void;
