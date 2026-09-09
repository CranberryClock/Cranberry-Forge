export interface Modifier {
  id: string;
  source: string;
  stat: string;
  kind: "flat" | "additivePercent" | "multiplier";
  value: number;
}
export interface StatConfig {
  base: Record<string, number>;
  modifiers?: Modifier[];
  bounds?: Record<string, { min?: number; max?: number }>;
  rounding?: number | null;
}
export interface Explanation {
  base: number;
  flat: number;
  additivePercent: number;
  multiplier: number;
  afterFlat: number;
  afterAdditive: number;
  raw: number;
  clamped: number;
  value: number;
  sources: Modifier[];
}
export interface StatResult {
  values: Record<string, number>;
  explanations: Record<string, Explanation>;
}
export function evaluateStats(config: StatConfig): StatResult;
export class Ledger {
  constructor(config: StatConfig);
  readonly result: StatResult;
  setModifier(modifier: Modifier): StatResult;
  removeSource(source: string): StatResult;
  snapshot(): StatConfig;
}
export function compareLoadouts(
  config: StatConfig,
  loadouts: { id: string; modifiers: Modifier[] }[],
): (StatResult & { id: string })[];
