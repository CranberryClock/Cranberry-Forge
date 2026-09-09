export type Metric = "bytes" | "triangles" | "textureWidth" | "textureHeight";
export interface Asset {
  id: string;
  path?: string;
  dependencies?: string[];
  requiredExtensions?: string[];
}
export interface AuditInput {
  manifest: Asset[];
  metrics?: Record<string, Partial<Record<Metric, number>>>;
  policy?: {
    budgets?: Partial<Record<Metric, number>>;
    allowedExtensions?: string[];
    missingMetrics?: "error" | "warning";
  };
}
export interface Finding {
  assetId: string;
  code: string;
  field: string;
  actual: string | number | null;
  expected: string | number | string[];
  severity: "error" | "warning";
}
export interface AuditReport {
  ok: boolean;
  findings: Finding[];
  summary: { assets: number; errors: number; warnings: number };
}
export function auditAssets(input: AuditInput): AuditReport;
