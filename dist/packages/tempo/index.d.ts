export interface AbilityDefinition {
  id: string;
  /** Maximum stored charges, integer 1–16. Default 1. */
  charges?: number;
  /** Seconds to restore ONE missing charge; sequential, not parallel. */
  recharge: number;
  /** Independent minimum interval after use; runs concurrently with recharge. Default 0. */
  cooldown?: number;
  /** False bypasses and does not trigger the shared global cooldown. Default true. */
  usesGlobalCooldown?: boolean;
}
export interface TempoOptions {
  globalCooldown?: number;
}
export type BlockReason = "global-cooldown" | "cooldown" | "no-charges";
export interface AbilityState {
  id: string;
  charges: number;
  maxCharges: number;
  rechargeRemaining: number;
  rechargeProgress: number;
  cooldownRemaining: number;
  globalRemaining: number;
  ready: boolean;
  reason: BlockReason | null;
  retryAfter: number;
}
export interface TempoState {
  time: number;
  globalRemaining: number;
  globalProgress: number;
  abilities: AbilityState[];
}
export type TempoEvent =
  | { type: "used" | "recharged"; id: string; at: number; charges: number }
  | { type: "cooldown-ready"; id: string; at: number }
  | { type: "global-ready"; at: number };
export type UseResult =
  | {
      ok: true;
      id: string;
      at: number;
      state: AbilityState;
      events: TempoEvent[];
    }
  | {
      ok: false;
      id: string;
      reason: BlockReason;
      retryAfter: number;
      state: AbilityState;
      events: [];
    };
export interface TempoSnapshot {
  schema: "cranberry-forge.tempo/1";
  definitions: Required<AbilityDefinition>[];
  globalCooldown: number;
  time: number;
  globalReadyAt: number | null;
  abilities: {
    id: string;
    charges: number;
    rechargeAt: number | null;
    cooldownUntil: number | null;
  }[];
}
export class Tempo {
  constructor(definitions: AbilityDefinition[], options?: TempoOptions);
  readonly definitions: Required<AbilityDefinition>[];
  readonly time: number;
  readonly globalCooldown: number;
  readonly state: TempoState;
  inspect(id: string): AbilityState;
  tryUse(id: string): UseResult;
  /** Finite seconds in [0,86400]. Host controls pause and time scale. */
  tick(dt: number): TempoEvent[];
  /** Refill all charges, clear cooldowns, and reset clock to zero. */
  reset(): TempoState;
  toSnapshot(): TempoSnapshot;
  restore(snapshot: TempoSnapshot | string): TempoState;
  static fromSnapshot(snapshot: TempoSnapshot | string): Tempo;
}
