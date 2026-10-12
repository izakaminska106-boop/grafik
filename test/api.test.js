import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
const directory = mkdtempSync(path.join(tmpdir(), "grafik-test-")),
  port = 3219;
let child;
const request = async (url, body, role = "manager") => {
  const r = await fetch(`http://127.0.0.1:${port}/api/${url}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-demo-role": role },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
test.before(async () => {
  child = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, PORT: String(port), GRAFIK_DATA_DIR: directory },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("API failed to start")), 15000);
    child.stdout.on("data", (data) => {
      if (data.toString().includes("Grafik API")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("error", reject);
    child.stderr.on("data", (d) => {
      if (d.toString().includes("Error")) {
        clearTimeout(timer);
        reject(Error(d.toString()));
      }
    });
  });
});
test.after(async () => {
  child?.kill();
  if (child) await new Promise((resolve) => child.once("exit", resolve));
  rmSync(directory, { recursive: true, force: true });
});
test("SQLite, version conflict, role restriction, audit and restore", async () => {
  let { data: s } = await request("state");
  const payload = {
    employeeId: "e0",
    date: "2026-11-02",
    code: "CUSTOM",
    start: "07:00",
    end: "19:00",
    actualMinutes: 750,
    locked: false,
  };
  assert.equal(
    (
      await request(
        "change",
        { revision: s.revision, kind: "shift", payload },
        "viewer",
      )
    ).status,
    403,
  );
  const saved = await request("change", {
    revision: s.revision,
    kind: "shift",
    payload,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.revision, s.revision + 1);
  const shift = saved.data.shifts.find((x) => x.date === payload.date);
  assert.equal(shift.actualMinutes, 750);
  assert.equal(
    (await request("change", { revision: s.revision, kind: "shift", payload }))
      .status,
    409,
  );
  assert.equal(
    (
      await request("change", {
        revision: saved.data.revision,
        kind: "approve",
        payload: { month: "2026-11" },
      })
    ).status,
    400,
  );
  const { data: a } = await request("audit");
  assert.equal(a.length, 1);
  const restored = await request("change", {
    revision: saved.data.revision,
    kind: "restore",
    payload: { id: a[0].id },
    reason: "Test przywrócenia",
  });
  assert.equal(restored.status, 200);
  assert(!restored.data.shifts.some((x) => x.id === shift.id));
  assert.equal((await request("audit")).data.length, 2);
});
test("Export creates a readable workbook with 4 sheets", async () => {
  const r = await fetch(`http://127.0.0.1:${port}/api/export?month=2026-10`);
  assert.equal(r.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await r.arrayBuffer()));
  assert.deepEqual(
    workbook.worksheets.map((s) => s.name),
    ["Grafik", "Podsumowanie", "Walidacja", "Legenda"],
  );
  assert(workbook.worksheets[0].rowCount > 90);
});
test("Restricted roles receive masked absence categories and no HR profile fields", async () => {
  const { data: s } = await request("state", null, "viewer");
  assert(!s.shifts.some((x) => x.code === "CH" || x.code === "U"));
  assert(s.employees.every((x) => x.leaveBalance === undefined));
  assert.equal((await request("audit", null, "employee")).status, 403);
});
