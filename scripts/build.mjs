import { mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { build } from "vite";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const project of ["backend", "frontend"]) {
  const filename = path.join(root, project, "tsconfig.json");
  const read = ts.readConfigFile(filename, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(filename),
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    console.error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
    process.exit(1);
  }
  if (project === "backend") program.emit();
  console.log(`${project}: TypeScript checks passed`);
}
const { default: config } = await import("../frontend/vite.config.mjs");
await build({
  ...config,
  configFile: false,
  root: path.join(root, "frontend"),
  build: { ...config.build, terserOptions: { maxWorkers: 0 } },
});
