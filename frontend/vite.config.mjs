import { defineConfig } from "vite";
import ts from "typescript";
import { minify } from "terser";
let production = false;
export default defineConfig({
  plugins: [
    {
      name: "typescript-in-process",
      enforce: "pre",
      configResolved(config) {
        production = config.command === "build";
      },
      transform(code, id) {
        if (!/\.[cm]?[jt]sx?(\?|$)/.test(id)) return;
        code = code
          .replaceAll(
            "process.env.NODE_ENV",
            JSON.stringify(production ? "production" : "development"),
          )
          .replaceAll("process.env", "({})")
          .replaceAll("import.meta.hot", production ? "undefined" : "import.meta.hot")
          .replaceAll("import.meta.env.DEV", String(!production))
          .replaceAll("import.meta.env.PROD", String(production))
          .replaceAll(
            "import.meta.env",
            JSON.stringify({
              MODE: production ? "production" : "development",
              BASE_URL: "/",
              DEV: !production,
              PROD: production,
              SSR: false,
            }),
          );
        if (id.includes("node_modules")) return { code, map: null };
        const output = ts.transpileModule(code, {
          fileName: id,
          compilerOptions: {
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            sourceMap: false,
          },
        });
        return { code: output.outputText, map: null };
      },
      async renderChunk(code) {
        if (production) {
          const result = await minify(code, {
            module: true,
            compress: true,
            mangle: true,
            format: { comments: false },
          });
          return { code: result.code, map: null };
        }
      },
    },
  ],
  esbuild: false,
  resolve: { preserveSymlinks: true },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:4000" } },
  build: {
    minify: false,
    cssMinify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            "react",
            "react-dom",
            "react-router-dom",
            "@tanstack/react-query",
          ],
        },
      },
    },
  },
});
