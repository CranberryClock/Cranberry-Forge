import { evaluateStats } from "../dist/packages/ledger/index.js";
import { migrateSave } from "../dist/packages/keepsake/index.js";
import { auditAssets } from "../dist/packages/sift/index.js";
import { memoryConfig } from "../dist/pipeline-fixtures.js";
export const pipelinePaths = [
  "/api/v1/ledger/evaluate",
  "/api/v1/keepsake/migrate",
  "/api/v1/sift/audit",
];
export function pipelineRequest(path, data) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new TypeError("Body must be an object");
  if (path === "/api/v1/ledger/evaluate") {
    if (
      Object.keys(data.base ?? {}).length > 256 ||
      (data.modifiers?.length ?? 0) > 2048
    )
      throw new RangeError("HTTP budget: 256 stats, 2048 modifiers");
    return evaluateStats(data);
  }
  if (path === "/api/v1/sift/audit") {
    if ((data.manifest?.length ?? 0) > 10000)
      throw new RangeError("HTTP budget: 10000 assets");
    return auditAssets(data);
  }
  if (path === "/api/v1/keepsake/migrate") {
    if (data.profile !== "observatory")
      throw new TypeError("Registered profile required: observatory");
    return migrateSave(data.save, memoryConfig);
  }
  throw new TypeError("Unknown pipeline route");
}
