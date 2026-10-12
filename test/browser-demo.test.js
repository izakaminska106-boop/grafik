import test from "node:test";
import assert from "node:assert/strict";
import { demoRequest, DEMO_STORAGE_KEY } from "../src/browser-demo.js";
function storage() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
  };
}
test("Pages demo saves changes, preserves history, restores state and detects stale edits", async () => {
  const db = storage(),
    s = await demoRequest("state", {}, "manager", db),
    payload = {
      employeeId: "e0",
      date: "2026-11-02",
      code: "R",
      start: "07:00",
      end: "15:00",
      actualMinutes: null,
    };
  const options = {
    body: JSON.stringify({ kind: "shift", revision: s.revision, payload }),
  };
  const next = await demoRequest("change", options, "manager", db);
  assert.equal(next.shifts.length, s.shifts.length + 1);
  assert.equal(
    (await demoRequest("state", {}, "manager", db)).revision,
    next.revision,
  );
  await assert.rejects(
    demoRequest("change", options, "manager", db),
    /Odśwież/,
  );
  const audit = await demoRequest("audit", {}, "manager", db);
  assert.equal(audit.length, 1);
  assert(!("snapshot" in audit[0]));
  const restored = await demoRequest(
    "change",
    {
      body: JSON.stringify({
        kind: "restore",
        revision: next.revision,
        payload: { id: audit[0].id },
        reason: "Test",
      }),
    },
    "manager",
    db,
  );
  assert.equal(restored.shifts.length, s.shifts.length);
  assert.equal(restored.revision, 2);
});
test("Pages roles preserve read-only restrictions and HR data masking", async () => {
  const db = storage(),
    s = await demoRequest("state", {}, "viewer", db);
  assert(s.employees.every((e) => e.leaveBalance === undefined));
  assert(!s.shifts.some((s) => s.code === "U"));
  await assert.rejects(demoRequest("audit", {}, "viewer", db), /uprawnień/);
  await assert.rejects(
    demoRequest(
      "change",
      {
        body: JSON.stringify({
          revision: 0,
          kind: "delete",
          payload: { id: s.shifts[0].id },
        }),
      },
      "viewer",
      db,
    ),
    /odczytu/,
  );
});
test("Pages storage failures do not silently reset previous data", async () => {
  const db = storage();
  db.setItem(DEMO_STORAGE_KEY, "broken");
  await assert.rejects(demoRequest("state", {}, "manager", db), /odczytać/);
});
