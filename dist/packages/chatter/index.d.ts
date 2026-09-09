export type Value = string | number | boolean;
export interface Effect {
  op: "set" | "add";
  variable: string;
  value: Value;
}
export interface Condition {
  op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
  variable: string;
  value: Value;
}
export interface Choice {
  id: string;
  text: string;
  target: string | null;
  once?: boolean;
  when?: Condition[];
  effects?: Effect[];
}
export interface Story {
  id: string;
  start: string;
  variables?: Record<string, Value>;
  nodes: Record<
    string,
    {
      speaker?: string;
      text: string;
      choices?: Choice[];
      next?: string | null;
      onEnter?: Effect[];
    }
  >;
}
export interface View {
  nodeId: string;
  speaker: string;
  text: string;
  ended: boolean;
  canAdvance: boolean;
  choices: { id: string; text: string; enabled: boolean }[];
}
export interface Snapshot {
  schema: "cranberry-forge.chatter/1";
  storyId: string;
  signature: string;
  nodeId: string;
  variables: Record<string, Value>;
  usedChoices: string[];
  visits: Record<string, number>;
  ended: boolean;
}
export type Result = { ok: true } | { ok: false; reason: string };
export function validateStory(value: unknown): Story;
export class Conversation {
  constructor(
    story: Story | unknown,
    options?: { snapshot?: Snapshot | string },
  );
  readonly variables: Record<string, Value>;
  readonly ended: boolean;
  readonly nodeId: string;
  readonly view: View;
  subscribe(listener: (view: View) => void): () => void;
  setVariables(values: Record<string, Value>): this;
  choose(choiceId: string): Result;
  advance(): Result;
  end(): this;
  toSnapshot(): Snapshot;
  static fromSnapshot(
    story: Story | unknown,
    snapshot: Snapshot | string,
  ): Conversation;
}
