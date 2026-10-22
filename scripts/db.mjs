import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync(
  process.execPath,
  ["--import", "tsx", "backend/src/database/cli.ts", process.argv[2]],
  { cwd: root, stdio: "inherit" },
);
if (r.error) console.error(r.error);
process.exit(r.status ?? 1);
