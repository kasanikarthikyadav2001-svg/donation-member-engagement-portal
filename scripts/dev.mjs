import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const children = [
  spawn(process.execPath, ["--import", "tsx", "backend/src/server.ts"], {
    cwd: root,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "--configLoader",
      "native",
    ],
    { cwd: path.join(root, "frontend"), stdio: "inherit" },
  ),
];
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    children.forEach((c) => c.kill(signal));
    process.exit();
  });
for (const child of children)
  child.on("error", (error) => {
    console.error(error);
    children.forEach((c) => c.kill());
    process.exit(1);
  });
for (const child of children)
  child.on("exit", (code) => {
    children.forEach((c) => c.kill());
    process.exit(code ?? 1);
  });
