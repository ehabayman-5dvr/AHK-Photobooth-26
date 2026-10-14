export interface FaceSummary {
  totalPeople: number; maleCount: number; femaleCount: number; childCount: number; unknownCount: number;
}
export function summarizeFaces(results: { age?: number; gender?: string; genderProbability?: number }[]): FaceSummary | null;
export function buildSubjectDirective(summary?: FaceSummary | null): string;
