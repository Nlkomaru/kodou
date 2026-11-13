import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(appDir, ".cloudflare/output/v0");
const workerDir = path.join(outputDir, "workers/default");

fs.rmSync(path.join(appDir, ".cloudflare/output"), { recursive: true, force: true });
fs.mkdirSync(workerDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "config.json"),
  JSON.stringify({ buildContext: { isPreview: false } }),
);

fs.writeFileSync(
  path.join(workerDir, "worker.config.json"),
  JSON.stringify({
    name: "kodou-sb",
    compatibilityDate: "2026-07-14",
    assets: { notFoundHandling: "single-page-application" },
    domains: ["kodou-sb.vrc.nikomaru.dev"],
  }),
);

fs.cpSync(path.join(appDir, "storybook-static"), path.join(workerDir, "assets"), {
  recursive: true,
  dereference: true,
});
