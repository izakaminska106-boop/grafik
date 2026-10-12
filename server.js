import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { dates, slots, validate, summarize } from "./src/domain.js";
import ExcelJS from "exceljs";
import path from "node:path";
const dataDir = process.env.GRAFIK_DATA_DIR || ".data";
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "grafik.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL, snapshot TEXT NOT NULL);",
);
const employees = [
  "Anna Kowalska",
  "Michał Nowak",
  "Katarzyna Wiśniewska",
  "Piotr Zieliński",
  "Magdalena Wójcik",
  "Tomasz Kamiński",
].map((name, i) => ({
  id: "e" + i,
  name,
  initials: name
    .split(" ")
    .map((x) => x[0])
    .join(""),
  role: i === 0 ? "Starsza realizatorka" : "Realizator emisji",
  fte: 1,
  leaveBalance: 208 * 60,
  uzUsed: 0,
  maxDaily: 720,
  noNight: false,
  skills: i % 2 === 0 ? ["Emisja", "LIVE"] : ["Emisja", "Koordynacja"],
}));
const shifts = [];
for (const date of dates("2026-10")) {
  const n = Number(date.slice(-2)) - 1,
    weekend = DateTime.fromISO(date).weekday > 5;
  const codes = weekend ? ["WER", "WEP", "WEN"] : ["R", "P", "P"];
  codes.forEach((code, j) => {
    const employeeId = "e" + ((n * 3 + j) % 6);
    shifts.push({
      id: randomUUID(),
      employeeId,
      date,
      code,
      start: slots[code][0],
      end: slots[code][1],
      actualMinutes: date < "2026-10-12" ? 480 : null,
      locked: false,
      version: 1,
    });
  });
}
// Synthetic example of leave: retain its original planned hours.
const leave = shifts.find(
  (s) => s.employeeId === "e2" && s.date > "2026-10-12",
);
if (leave) {
  leave.originalCode = leave.code;
  leave.code = "U";
}
const seed = {
  employees,
  shifts,
  tasks: [
    {
      id: randomUUID(),
      name: "Transmisja LIVE · mecz reprezentacji",
      date: "2026-10-14",
      start: "19:00",
      hours: 3,
      weight: 5,
      employeeId: "e4",
      skill: "LIVE",
    },
    {
      id: randomUUID(),
      name: "Koordynacja pasma wieczornego",
      date: "2026-10-16",
      start: "17:00",
      hours: 4,
      weight: 3,
      employeeId: "e5",
      skill: "Koordynacja",
    },
    {
      id: randomUUID(),
      name: "Przygotowanie ramówki weekendowej",
      date: "2026-10-16",
      start: "09:00",
      hours: 2,
      weight: 2,
      employeeId: "e3",
      skill: "Emisja",
    },
  ],
  settings: {
    nightStart: "22:00",
    adjacentVerified: false,
    hrApproved: false,
    weekdayDemand: [
      { start: "07:00", end: "15:00", count: 1 },
      { start: "15:00", end: "23:00", count: 2 },
    ],
    weekendDemand: [
      { start: "07:00", end: "15:00", count: 1 },
      { start: "15:00", end: "23:00", count: 1 },
      { start: "22:00", end: "06:00", count: 1 },
    ],
    holidayDemand: [],
    period: "Miesięczny",
    rulesVersion: "PL-demo-2026.1",
  },
  status: {},
};
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
  if (["employee", "viewer"].includes(req.role)) {
    s.shifts = s.shifts.map((x) =>
      ["U", "UŻ", "CH", "UB", "IN"].includes(x.code)
        ? { ...x, code: "IN", originalCode: undefined }
        : x,
    );
    s.employees = s.employees.map(
      ({ leaveBalance, uzUsed, maxDaily, noNight, ...e }) => e,
    );
  }
  res.json(s);
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
    let action = "";
    if (!payload || typeof payload !== "object")
      throw Error("Brak danych operacji");
    if (kind === "shift") {
      if (
        !s.employees.some((e) => e.id === payload.employeeId) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
        ![
          "R",
          "P",
          "WER",
          "WEP",
          "WEN",
          "CUSTOM",
          "U",
          "UŻ",
          "CH",
          "UB",
          "IN",
          "W",
        ].includes(payload.code)
      )
        throw Error("Nieprawidłowy przydział.");
      for (const t of [payload.start, payload.end])
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))
          throw Error("Nieprawidłowa godzina.");
      if (payload.code === "W" && !payload.freeReason)
        throw Error("Wybierz powód dnia wolnego.");
      if (!DateTime.fromISO(payload.date).isValid)
        throw Error("Nieprawidłowa data.");
      if (
        payload.actualMinutes !== null &&
        payload.actualMinutes !== undefined &&
        (!Number.isInteger(payload.actualMinutes) ||
          payload.actualMinutes < 0 ||
          payload.actualMinutes > 2880)
      )
        throw Error("Nieprawidłowe wykonanie.");
      let prev = s.shifts.find((x) => x.id === payload.id);
      if (prev?.locked && !payload.unlock)
        throw Error("Wpis jest zablokowany. Odblokuj go przed zmianą.");
      const next = {
        ...payload,
        id: prev?.id || randomUUID(),
        version: (prev?.version || 0) + 1,
      };
      delete next.unlock;
      s.shifts = s.shifts.filter((x) => x.id !== next.id);
      s.shifts.push(next);
      action = `Zmiana grafiku: ${s.employees.find((e) => e.id === next.employeeId).name}, ${next.date}, ${next.code}`;
    } else if (kind === "delete") {
      const prev = s.shifts.find((x) => x.id === payload.id);
      if (prev?.locked) throw Error("Wpis jest zablokowany.");
      s.shifts = s.shifts.filter((x) => x.id !== payload.id);
      action = "Usunięcie wpisu grafiku";
    } else if (kind === "employee") {
      if (req.role !== "hr")
        throw Error("Profile i salda może zmieniać wyłącznie rola Kadry.");
      if (
        !payload.name?.trim() ||
        !Number.isFinite(payload.leaveBalance) ||
        payload.leaveBalance < 0 ||
        payload.fte <= 0 ||
        payload.fte > 1
      )
        throw Error("Nieprawidłowy profil pracownika.");
      s.employees = s.employees.map((e) =>
        e.id === payload.id ? { ...e, ...payload } : e,
      );
      action = "Aktualizacja profilu pracownika";
    } else if (kind === "task") {
      if (
        !payload.name?.trim() ||
        payload.hours <= 0 ||
        payload.weight < 1 ||
        payload.weight > 5
      )
        throw Error("Uzupełnij zadanie, czas i wagę 1–5.");
      s.tasks = s.tasks.filter((t) => t.id !== payload.id);
      s.tasks.push({ ...payload, id: payload.id || randomUUID() });
      action = "Aktualizacja zadania emisji";
    } else if (kind === "settings") {
      if (req.role !== "hr") throw Error("Ustawienia wymagają roli Kadry.");
      if (!["21:00", "22:00", "23:00"].includes(payload.nightStart))
        throw Error("Nieprawidłowa pora nocna.");
      for (const key of ["weekdayDemand", "weekendDemand", "holidayDemand"]) {
        if (
          !Array.isArray(payload[key]) ||
          payload[key].length > 24 ||
          payload[key].some(
            (r) =>
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start) ||
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end) ||
              !Number.isInteger(r.count) ||
              r.count < 1 ||
              r.count > 6,
          )
        )
          throw Error("Nieprawidłowe zapotrzebowanie.");
      }
      s.settings = {
        ...s.settings,
        ...payload,
        adjacentVerified: false,
        hrApproved: false,
      };
      action = "Zmiana ustawień zakładowych";
    } else if (kind === "approve") {
      const issues = validate(s, payload.month);
      if (
        issues.some((x) => x.severity === "error") ||
        issues.some((x) => x.rule === "Niepełna walidacja") ||
        !s.settings.hrApproved
      )
        throw Error(
          "Zatwierdzenie zablokowane: naruszenia lub niepełna walidacja. Prototyp wymaga odbioru kadrowego.",
        );
      throw Error("Publikacja produkcyjna nie jest dostępna w prototypie.");
    } else if (kind === "restore") {
      if (!reason?.trim()) throw Error("Podaj powód przywrócenia.");
      const old = db
        .prepare("SELECT snapshot FROM audit WHERE id=?")
        .get(payload.id);
      if (!old) throw Error("Brak wersji.");
      Object.assign(s, JSON.parse(old.snapshot), { revision });
      action = "Przywrócenie wersji: " + reason;
    } else throw Error("Nieznana operacja");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "INSERT INTO audit(time,role,action,snapshot) VALUES(?,?,?,?)",
      ).run(
        new Date().toISOString(),
        req.role,
        action + (reason ? " · " + reason : ""),
        JSON.stringify(read()),
      );
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
    const s = read(),
      wb = new ExcelJS.Workbook(),
      sensitive = ["manager", "hr"].includes(req.role);
    wb.creator = "Grafik Emisji";
    const add = (name, rows) => {
      const sheet = wb.addWorksheet(name);
      if (!rows.length) rows = [{ Informacja: "Brak danych w okresie" }];
      sheet.columns = Object.keys(rows[0]).map((key) => ({
        header: key,
        key,
        width: key === "Pracownik" ? 28 : 22,
      }));
      rows.forEach((row) => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF245A44" },
      };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheet.columns.length },
      };
    };
    add(
      "Grafik",
      s.shifts
        .filter((x) => x.date.startsWith(month))
        .map((x) => ({
          Pracownik: s.employees.find((e) => e.id === x.employeeId)?.name,
          Data: x.date,
          Kod:
            !sensitive && ["U", "UŻ", "CH", "UB", "IN"].includes(x.code)
              ? "Nieobecność"
              : x.code,
          Od: x.start,
          Do: x.end,
          Wykonanie_h:
            x.actualMinutes === null ? null : (x.actualMinutes ?? 0) / 60,
        })),
    );
    add(
      "Podsumowanie",
      summarize(s, month).map((x) => ({
        Pracownik: x.name,
        Wymiar_h: x.nominal / 60,
        Plan_h: x.planned / 60,
        Wykonanie_h: x.actual / 60,
        Nieobecności_h: x.absent / 60,
        Punkty: x.points,
      })),
    );
    add("Walidacja", validate(s, month));
    add(
      "Legenda",
      Object.entries({
        ...slots,
        U: ["Urlop"],
        UŻ: ["Urlop na żądanie"],
        CH: ["Choroba"],
        W: ["Dzień wolny"],
      })
        .filter(([k]) => sensitive || !["U", "UŻ", "CH"].includes(k))
        .map(([Kod, Godziny]) => ({ Kod, Opis: Godziny.join(" – ") })),
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Grafik-${month}.xlsx"`,
    );
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .send(Buffer.from(await wb.xlsx.writeBuffer()));
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
