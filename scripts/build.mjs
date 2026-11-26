import { build } from "esbuild";
import { mkdirSync } from "node:fs";

const common = { logLevel: "info", legalComments: "inline" };
mkdirSync("plugin", { recursive: true });
mkdirSync("service", { recursive: true });
mkdirSync("panel", { recursive: true });

await Promise.all([
  build({
    ...common, entryPoints: ["src/plugin/index.mjs"], outfile: "plugin/index.js",
    bundle: true, format: "esm", platform: "node", target: "node24",
  }),
  build({
    ...common, entryPoints: ["src/service/main.mjs"], outfile: "service/index.js",
    bundle: true, format: "esm", platform: "node", target: "node24",
  }),
  build({
    ...common, entryPoints: ["src/panel/main.mjs"], outfile: "panel/main.js",
    bundle: true, format: "iife", platform: "browser", target: ["chrome120", "safari17"],
  }),
]);
