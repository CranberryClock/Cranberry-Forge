import { createAppServer } from "./server.mjs";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    host: { type: "string" },
    port: { type: "string" },
    strictPort: { type: "boolean" },
  },
});
const port = Number(values.port ?? process.env.PORT ?? 4173),
  host = values.host ?? process.env.HOST ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new RangeError("PORT must be 1–65535");
const server = createAppServer();
server.listen(port, host, () =>
  console.log(`Cranberry Forge workbench and optional HTTP API: http://${host}:${port}`),
);
