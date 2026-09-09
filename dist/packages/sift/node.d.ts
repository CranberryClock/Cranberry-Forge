import type { AuditInput, AuditReport } from "./index.js";
export function auditFiles(
  input: AuditInput,
  options?: { root?: string; maxAssets?: number },
): Promise<AuditReport>;
export function readAuditInput(
  path: string,
  options?: { maxBytes?: number },
): Promise<unknown>;
