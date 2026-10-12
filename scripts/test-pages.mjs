import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import ExcelJS from "exceljs";
import assert from "node:assert/strict";
const root = path.resolve("dist-pages");
let apiRequests = 0;
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  if (name.includes("/api/")) apiRequests++;
  let file = path.resolve(root, "." + name.replace(/^\/grafik/, ""));
  if (name.endsWith("/")) file = path.join(file, "index.html");
  if (!file.startsWith(root + path.sep) || !existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
  };
  res.setHeader(
    "Content-Type",
    types[path.extname(file)] || "application/octet-stream",
  );
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(4179, "127.0.0.1", resolve));
let browser;
try {
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["scripts/smoke.mjs"], {
      env: { ...process.env, GRAFIK_URL: "http://127.0.0.1:4179/grafik/" },
      stdio: "inherit",
    });
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Pages UI smoke failed")),
    );
    p.on("error", reject);
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4179/grafik/");
  await page.getByRole("heading", { name: "Pulpit zespołu" }).waitFor();
  await page
    .getByRole("button", { name: "Zadania emisji", exact: true })
    .click();
  await page.getByRole("button", { name: "Nowe zadanie" }).click();
  await page.getByLabel("Nazwa", { exact: true }).fill("Test trwałości demo");
  await page
    .getByRole("button", { name: "Zapisz zadanie", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page.getByRole("heading", { name: "Pulpit zespołu" }).waitFor();
  await page
    .getByRole("button", { name: "Zadania emisji", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Test trwałości demo", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Grafik emisji", exact: true })
    .click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Eksport XLSX", exact: true }).click();
  const download = await event,
    file = await download.path();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(file));
  assert.equal(workbook.worksheets.length, 4);
  assert.deepEqual(errors, []);
  assert.equal(apiRequests, 0);
  console.log(
    "PASS: Pages under /grafik/site/, persistence after reload, readable XLSX, zero backend requests.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
