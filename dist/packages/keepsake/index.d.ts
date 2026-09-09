export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };
export interface Save {
  format: string;
  version: number;
  payload: JSONValue;
}
export interface Step {
  from: number;
  to: number;
}
export type MigrationResult =
  | { ok: true; save: Save; fromVersion: number; trace: Step[] }
  | {
      ok: false;
      error: { code: string; message: string; version: number | null };
      trace: Step[];
    };
export interface MigrationConfig {
  format: string;
  targetVersion: number;
  migrations?: Record<number, (payload: JSONValue) => JSONValue>;
  validators: Record<number, (payload: JSONValue) => true | false | string>;
}
export function createSave(
  format: string,
  schemaVersion: number,
  payload: JSONValue,
): Save;
export function migrateSave(
  input: unknown,
  config: MigrationConfig,
): MigrationResult;
export interface Change {
  path: string;
  kind: "add" | "remove" | "replace";
  before?: JSONValue;
  after?: JSONValue;
}
export function diffSaves(
  before: JSONValue,
  after: JSONValue,
  options?: { limit?: number },
): { changes: Change[]; truncated: boolean };
