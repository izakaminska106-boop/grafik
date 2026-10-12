import { build } from "vite";
import { writeFileSync, cpSync } from "node:fs";
process.env.VITE_GITHUB_PAGES = "true";
await build({ build: { outDir: "dist-pages/site", emptyOutDir: true } });
writeFileSync(
  "dist-pages/index.html",
  '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./site/"><title>Grafik Emisji</title></head><body><a href="./site/">Otwórz Grafik Emisji</a></body></html>',
);
writeFileSync("dist-pages/.nojekyll", "");

// Retain a compiled copy for the existing Pages source: main / (root).
cpSync("dist-pages/site", "site", { recursive: true });
