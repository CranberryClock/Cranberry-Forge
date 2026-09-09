import type { Conversation } from "./index.js";
export function mountDialogue(
  container: HTMLElement,
  conversation: Conversation,
  options?: { charactersPerSecond?: number; onEnd?: () => void },
): { finishLine(): void; dispose(): void };
