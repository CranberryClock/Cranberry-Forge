export declare const VERSION: "0.1.0";
export declare const SNAPSHOT_VERSION: 1;
export declare const LIMITS: Readonly<{
  quests: 128;
  objectivesPerQuest: 64;
  objectives: 1024;
  prerequisites: 32;
  tags: 16;
  idLength: 96;
  target: 1000000000;
  eventAmount: 1000000;
  dedupeCapacity: 10000;
}>;
export type TrailmarkErrorCode =
  | "INVALID_INPUT"
  | "INVALID_DEFINITION"
  | "INVALID_SNAPSHOT"
  | "INCOMPATIBLE_SNAPSHOT"
  | "UNKNOWN_QUEST"
  | "LIMIT_REACHED";
export declare class TrailmarkError extends Error {
  readonly code: TrailmarkErrorCode;
  constructor(code: TrailmarkErrorCode, message: string);
}
export interface ObjectiveDefinition {
  id: string;
  title?: string;
  type: string;
  tags?: readonly string[];
  target: number;
}
export interface QuestDefinition {
  id: string;
  title?: string;
  description?: string;
  prerequisites?: readonly string[];
  objectives: readonly ObjectiveDefinition[];
}
export interface JournalEvent {
  id: string;
  type: string;
  tags?: readonly string[];
  amount?: number;
}
export interface CompletionReceipt {
  id: string;
  questId: string;
  completedAt: number;
  eventId: string;
  claimedAt: number | null;
}
export interface ObjectiveView {
  id: string;
  title: string;
  type: string;
  tags: string[];
  target: number;
  count: number;
  complete: boolean;
}
export type QuestStatus =
  | "locked"
  | "available"
  | "active"
  | "completed"
  | "claimed";
export interface QuestView {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  prerequisites: string[];
  missingPrerequisites: string[];
  activatedAt: number | null;
  objectives: ObjectiveView[];
  receipt: CompletionReceipt | null;
}
export interface ActivationResult {
  activated: boolean;
  reason: "already-started" | "prerequisites" | null;
  quest: QuestView;
}
export interface ObjectiveChange {
  questId: string;
  objectiveId: string;
  before: number;
  after: number;
  target: number;
}
export interface DispatchResult {
  accepted: boolean;
  duplicate: boolean;
  sequence: number;
  changes: ObjectiveChange[];
  completed: CompletionReceipt[];
}
export interface SnapshotQuest {
  id: string;
  status: "idle" | "active" | "completed" | "claimed";
  activatedAt: number | null;
  counters: { id: string; count: number }[];
  receipt: CompletionReceipt | null;
}
export interface JournalSnapshot {
  version: 1;
  catalogKey: string;
  dedupeCapacity: number;
  sequence: number;
  recentEvents: { id: string; sequence: number }[];
  quests: SnapshotQuest[];
}
export interface JournalOptions {
  dedupeCapacity?: number;
  snapshot?: unknown;
}
export interface Journal {
  get(id: string): QuestView;
  list(): QuestView[];
  activate(id: string): ActivationResult;
  dispatch(event: JournalEvent): DispatchResult;
  claim(id: string): CompletionReceipt | null;
  snapshot(): JournalSnapshot;
  /** Atomic replacement after validation. Does not emit completions or claims. */
  restore(snapshot: unknown): QuestView[];
}
export declare function createJournal(
  definitions: readonly QuestDefinition[],
  options?: JournalOptions,
): Journal;
