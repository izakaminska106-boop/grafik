import express from "express";
import { createSeed } from "./src/seed.js";
import { applyChange, maskState } from "./src/operations.js";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createWorkbook } from "./src/export.js";
import path from "node:path";
const dataDir = process.env.GRAFIK_DATA_DIR || ".data";
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "grafik.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL, snapshot TEXT NOT NULL);",
);
const seed = createSeed(randomUUID);
if (!db.prepare("SELECT id FROM state").get())
  db.prepare("INSERT INTO state VALUES (1,0,?)").run(JSON.stringify(seed));
function read() {
  const r = db.prepare("SELECT * FROM state WHERE id=1").get();
  return { ...JSON.parse(r.json), revision: r.revision };
}
const app = express();
app.use(express.json({ limit: "2mb" }));
// Explicit local demonstration roles. Production requires authenticated identities.
app.use("/api", (req, res, next) => {
  req.role = req.headers["x-demo-role"] || "manager";
  if (!["manager", "hr", "employee", "viewer"].includes(req.role))
    return res.status(403).json({ error: "Nieznana rola" });
  next();
});
app.get("/api/state", (req, res) => {
  const s = read();
  res.json(maskState(s, req.role));
});
app.get("/api/audit", (req, res) => {
  if (!["manager", "hr"].includes(req.role))
    return res.status(403).json({ error: "Brak uprawnień" });
  res.json(
    db
      .prepare(
        "SELECT id,time,role,action FROM audit ORDER BY id DESC LIMIT 100",
      )
      .all(),
  );
});
app.post("/api/change", (req, res) => {
  if (!["manager", "hr"].includes(req.role))
    return res
      .status(403)
      .json({ error: "Ta rola ma dostęp tylko do odczytu." });
  const { revision, kind, payload, reason } = req.body,
    s = read();
  if (revision !== s.revision)
    return res.status(409).json({
      error: "Dane zostały zmienione. Odśwież widok przed ponowną edycją.",
    });
  try {
    const stored =
      kind === "restore"
        ? db.prepare("SELECT snapshot FROM audit WHERE id=?").get(payload.id)
        : undefined;
    const result = applyChange(
      s,
      { revision, kind, payload, reason },
      req.role,
      stored ? JSON.parse(stored.snapshot) : undefined,
      randomUUID,
    );
    const action = result.action;
    Object.assign(s, result.state);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "INSERT INTO audit(time,role,action,snapshot) VALUES(?,?,?,?)",
      ).run(new Date().toISOString(), req.role, action, JSON.stringify(read()));
      delete s.revision;
      const result = db
        .prepare(
          "UPDATE state SET json=?,revision=revision+1 WHERE id=1 AND revision=?",
        )
        .run(JSON.stringify(s), revision);
      if (result.changes !== 1) throw Error("Konflikt wersji");
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json(read());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.get("/api/export", async (req, res) => {
  try {
    const month = req.query.month;
    if (!/^\d{4}-\d{2}$/.test(month || ""))
      return res.status(400).json({ error: "Nieprawidłowy miesiąc" });
    const data = await createWorkbook(read(), month, req.role);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Grafik-${month}.xlsx"`,
    );
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .send(Buffer.from(data));
  } catch (e) {
    res.status(500).json({ error: "Eksport nie powiódł się" });
  }
});
app.use(express.static("dist"));
app.get("/{*path}", (req, res) =>
  res.sendFile(process.cwd() + "/dist/index.html"),
);
app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log("Grafik API: port " + (process.env.PORT || 3001)),
);
