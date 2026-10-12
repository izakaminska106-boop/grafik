import test from "node:test";
import assert from "node:assert/strict";
import {
  validate,
  summarize,
  nominal,
  leaveYearSummary,
} from "../src/domain.js";
import ExcelJS from "exceljs";
import { createWorkbook } from "../src/export.js";
import { demoRequest, DEMO_STORAGE_KEY } from "../src/browser-demo.js";
import { applyChange, maskState } from "../src/operations.js";

const shift = (id, date, code, start = "07:00", end = "15:00") => ({
  id,
  employeeId: "e0",
  date,
  code,
  start,
  end,
  actualMinutes: 0,
});
const fixture = (shifts) => ({
  revision: 0,
  employees: [
    { id: "e0", name: "Test D03/D04", fte: 1, leaveBalance: 12480, skills: [] },
  ],
  shifts,
  tasks: [],
  settings: {
    nightStart: "22:00",
    adjacentVerified: false,
    hrApproved: false,
    weekdayDemand: [],
    weekendDemand: [],
    holidayDemand: [],
  },
});
const conflicts = (state, month) =>
  validate(state, month).filter((x) => x.rule === "Praca podczas nieobecności");

test("D03: CH 07–15 blokuje P 15–23 tej samej daty", () => {
  const state = fixture([
    shift("ch", "2026-10-15", "CH"),
    shift("p", "2026-10-15", "P", "15:00", "23:00"),
  ]);
  const original = structuredClone(state),
    result = conflicts(state, "2026-10");
  assert.equal(result.length, 1);
  assert.equal(result[0].employee, "Test D03/D04");
  assert.match(result[0].detail, /2026-10-15/);
  assert.deepEqual(state, original);
  assert.equal(summarize(state, "2026-10")[0].absent, 480); // CH nie tworzy 24 h odliczenia
});

test("D03: CH na dniu wolnym nadal blokuje pracę, bez fikcyjnych godzin nieobecności", () => {
  const ch = {
    ...shift("ch", "2026-10-15", "CH", "00:00", "00:00"),
    originalCode: "W",
  };
  const state = fixture([ch, shift("p", "2026-10-15", "P", "15:00", "23:00")]);
  assert.equal(conflicts(state, "2026-10").length, 1);
  assert.equal(summarize(state, "2026-10")[0].absent, 0);
});

test("D03: noc z poprzedniego miesiąca koliduje z CH po północy w obu raportach", () => {
  const state = fixture([
    shift("night", "2026-10-31", "WEN", "22:00", "06:00"),
    shift("ch", "2026-11-01", "CH"),
  ]);
  for (const month of ["2026-10", "2026-11"])
    assert.equal(conflicts(state, month).length, 1);
});

test("D03: CH kończy się o północy; nie obejmuje pracy następnego dnia", () => {
  const state = fixture([
    shift("ch", "2026-10-15", "CH", "22:00", "06:00"),
    shift("r", "2026-10-16", "R"),
  ]);
  assert.equal(conflicts(state, "2026-10").length, 0);
  assert.equal(summarize(state, "2026-10")[0].absent, 120);
});

test("D03: koniec zmiany dokładnie na początku CH nie jest kolizją", () => {
  const state = fixture([
    shift("night", "2026-10-31", "CUSTOM", "16:00", "00:00"),
    shift("ch", "2026-11-01", "CH"),
  ]);
  assert.equal(conflicts(state, "2026-10").length, 0);
  assert.equal(conflicts(state, "2026-11").length, 0);
});

test("D03: daty i godziny pierwotnej zmiany zachowane przy zmianie na CH", () => {
  const state = fixture([
    shift("night", "2026-10-31", "WEN", "22:00", "06:00"),
  ]);
  const original = structuredClone(state);
  const next = applyChange(
    state,
    {
      revision: 0,
      kind: "shift",
      payload: { ...state.shifts[0], code: "CH", start: "07:00", end: "15:00" },
    },
    "manager",
  ).state;
  assert.equal(next.shifts[0].id, "night");
  assert.equal(next.shifts[0].originalCode, "WEN");
  assert.equal(next.shifts[0].originalDate, "2026-10-31");
  assert.equal(next.shifts[0].originalStart, "22:00");
  assert.equal(next.shifts[0].originalEnd, "06:00");
  assert.deepEqual(state, original);
});

test("D03: chorobowe różnych pracowników nie blokuje pracy innych osób", () => {
  const state = fixture([
    shift("ch", "2026-10-15", "CH"),
    { ...shift("p", "2026-10-15", "P", "15:00", "23:00"), employeeId: "e1" },
  ]);
  state.employees.push({ ...state.employees[0], id: "e1" });
  assert.equal(conflicts(state, "2026-10").length, 0);
  assert.equal(nominal("2026-10"), 10560);
});

test("D04: CH i U tego samego dnia nie odliczają godzin dwa razy", () => {
  const state = fixture([
    shift("ch", "2026-10-15", "CH"),
    shift("u", "2026-10-15", "U", "15:00", "23:00"),
  ]);
  const original = structuredClone(state),
    sum = summarize(state, "2026-10")[0];
  assert.equal(sum.absent, 480);
  assert.equal(sum.leave, 0);
  assert.equal(sum.interruptedLeave, 480);
  assert.equal(sum.leaveInterrupted, true);
  assert(
    validate(state, "2026-10").some(
      (x) =>
        x.rule === "Urlop przerwany z powodu choroby" && /kadry/i.test(x.fix),
    ),
  );
  assert.deepEqual(state, original);
});

test("D04: jedna data CH przerywa wyłącznie część nocnego urlopu w tym dniu", () => {
  const state = fixture([
    shift("ch", "2026-10-31", "CH", "22:00", "06:00"),
    shift("u", "2026-10-31", "U", "22:00", "06:00"),
  ]);
  const left = summarize(state, "2026-10")[0],
    right = summarize(state, "2026-11")[0];
  assert.equal(left.absent, 120);
  assert.equal(left.interruptedLeave, 120);
  assert.equal(left.leave, 0);
  assert.equal(right.absent, 360);
  assert.equal(right.interruptedLeave, 0);
  assert.equal(right.leave, 360);
  assert.equal(leaveYearSummary(state, "e0", "2026").used, 360);
});

test("D04: CH po północy wyłącza tylko sporną część urlopu z poprzedniego miesiąca", () => {
  const state = fixture([
    shift("u", "2026-10-31", "U", "22:00", "06:00"),
    shift("ch", "2026-11-01", "CH"),
  ]);
  assert.equal(summarize(state, "2026-10")[0].leave, 120);
  const next = summarize(state, "2026-11")[0];
  assert.equal(next.absent, 480);
  assert.equal(next.interruptedLeave, 360);
  assert.equal(next.leave, 0);
});

test("D04: niepotwierdzone CH nie przerywa zaakceptowanego urlopu", () => {
  const state = fixture([
    shift("u", "2026-10-15", "U"),
    { ...shift("ch", "2026-10-15", "CH"), sicknessStatus: "reported" },
  ]);
  const sum = summarize(state, "2026-10")[0];
  assert.equal(sum.absent, 480);
  assert.equal(sum.leave, 480);
  assert.equal(sum.interruptedLeave, 0);
  assert.equal(sum.planned, 0);
  assert.equal(sum.ill, 0);
  assert(
    validate(state, "2026-10").some(
      (x) => x.rule === "Wymaga weryfikacji przez kadry",
    ),
  );
  assert(
    !validate(state, "2026-10").some(
      (x) => x.rule === "Urlop przerwany z powodu choroby",
    ),
  );
});

test("D04: zgłoszony lub odrzucony urlop nie jest rozliczany jako przerwany", () => {
  for (const requestStatus of ["zgłoszony", "odrzucony", "wycofany"]) {
    const state = fixture([
      shift("ch", "2026-10-15", "CH"),
      { ...shift("u", "2026-10-15", "U"), requestStatus },
    ]);
    assert.equal(summarize(state, "2026-10")[0].interruptedLeave, 0);
    assert(
      !validate(state, "2026-10").some(
        (x) => x.rule === "Urlop przerwany z powodu choroby",
      ),
    );
  }
});

test("D04: potwierdzenie CH zwraca saldo i zapisuje korektę, bez zmian dat urlopu", () => {
  const state = fixture([
    { ...shift("u", "2026-10-15", "U"), requestStatus: "zaakceptowany" },
  ]);
  const original = structuredClone(state);
  const result = applyChange(
    state,
    {
      revision: 0,
      kind: "shift",
      payload: {
        ...shift("ch", "2026-10-15", "CH"),
        sicknessStatus: "confirmed",
      },
    },
    "hr",
    undefined,
    () => "ch",
  );
  assert.equal(leaveYearSummary(state, "e0", "2026").used, 480);
  assert.equal(leaveYearSummary(result.state, "e0", "2026").used, 0);
  assert.deepEqual(
    result.state.shifts.find((x) => x.id === "u"),
    state.shifts[0],
  );
  assert.equal(result.state.leaveCorrections.length, 1);
  const correction = result.state.leaveCorrections[0];
  assert.equal(correction.restoredMinutes, 480);
  assert.equal(correction.leaveId, "u");
  assert.equal(correction.originalLeave.requestStatus, "zaakceptowany");
  assert.deepEqual(correction.sickness, [{ id: "ch", date: "2026-10-15" }]);
  assert.match(result.action, /art. 166 KP/);
  assert.deepEqual(state, original);
  const repeated = applyChange(
    result.state,
    {
      revision: 1,
      kind: "shift",
      payload: result.state.shifts.find((x) => x.id === "ch"),
    },
    "hr",
  ).state;
  assert.equal(repeated.leaveCorrections.length, 1); // idempotent: nie zwracaj drugi raz
  const reverted = applyChange(
    repeated,
    {
      revision: 2,
      kind: "shift",
      payload: {
        ...repeated.shifts.find((x) => x.id === "ch"),
        sicknessStatus: "reported",
      },
    },
    "hr",
  ).state;
  assert.equal(leaveYearSummary(reverted, "e0", "2026").used, 480);
  assert.equal(reverted.leaveCorrections.length, 2);
  assert.equal(reverted.leaveCorrections[1].previousRestoredMinutes, 480);
  assert.equal(reverted.leaveCorrections[1].restoredMinutes, 0);
});

test("D04: zmiana U na zgłoszenie CH zachowuje pierwotny zaakceptowany U", () => {
  const state = fixture([
    { ...shift("u", "2026-10-15", "U"), requestStatus: "zaakceptowany" },
  ]);
  const result = applyChange(
    state,
    {
      revision: 0,
      kind: "shift",
      payload: { ...state.shifts[0], code: "CH", sicknessStatus: "reported" },
    },
    "manager",
    undefined,
    () => "ch-new",
  ).state;
  assert.equal(result.shifts.length, 2);
  assert.deepEqual(
    result.shifts.find((x) => x.id === "u"),
    state.shifts[0],
  );
  assert.equal(result.shifts.find((x) => x.id === "ch-new").sourceLeaveId, "u");
  assert.equal(leaveYearSummary(result, "e0", "2026").used, 480);
  assert.equal(summarize(result, "2026-10")[0].planned, 0);
});

test("D04: potwierdzenie nowego okresu choroby wymaga roli Kadry", () => {
  const state = fixture([]);
  assert.throws(
    () =>
      applyChange(
        state,
        {
          revision: 0,
          kind: "shift",
          payload: {
            ...shift("ch", "2026-10-15", "CH"),
            sicknessStatus: "confirmed",
          },
        },
        "manager",
      ),
    /Kadry/,
  );
});

test("D04: nocny urlop po obu stronach roku zachowuje jedną korektę i sumę godzin", () => {
  const state = fixture([
    shift("u", "2026-12-31", "U", "22:00", "06:00"),
    shift("ch", "2027-01-01", "CH"),
  ]);
  const left = summarize(state, "2026-12")[0],
    right = summarize(state, "2027-01")[0];
  assert.equal(left.leave, 120);
  assert.equal(right.leave, 0);
  assert.equal(right.interruptedLeave, 360);
  assert.equal(left.absent + right.absent, 600); // 2 h U + 8 h planowej podstawy CH
  assert.equal(leaveYearSummary(state, "e0", "2026").restored, 360);
});

test("D04: XLSX pokazuje podstawy, pojedyncze odliczenie, saldo i informację o przerwaniu", async () => {
  const state = fixture([
    { ...shift("u", "2026-10-15", "U"), requestStatus: "zaakceptowany" },
    shift("ch", "2026-10-15", "CH"),
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(await createWorkbook(state, "2026-10", "hr")),
  );
  const sheet = workbook.getWorksheet("Grafik");
  const col = (name) => sheet.getRow(1).values.indexOf(name);
  assert.equal(sheet.rowCount, 3);
  const u = sheet.getRow(2),
    ch = sheet.getRow(3);
  assert.equal(u.getCell(col("Nieobecnosci_h")).value, 0);
  assert.equal(ch.getCell(col("Nieobecnosci_h")).value, 8);
  assert.equal(u.getCell(col("Podstawa_nieobecnosci_h")).value, 8);
  assert.equal(u.getCell(col("Urlop_przerwany_h")).value, 8);
  assert.match(
    u.getCell(col("Status_nieobecnosci")).value,
    /art. 166 Kodeksu pracy/,
  );
  const summary = workbook.getWorksheet("Podsumowanie");
  const c = (name) => summary.getRow(1).values.indexOf(name);
  assert.equal(summary.getRow(2).getCell(c("Nieobecności_h")).value, 8);
  assert.equal(
    summary.getRow(2).getCell(c("Saldo_urlopu_roczne_h")).value,
    208,
  );
});

test("D04: role z maskowaniem zachowują prawidłowe godziny bez ujawniania przyczyny", () => {
  const state = fixture([
    shift("u", "2026-10-15", "U"),
    shift("ch", "2026-10-15", "CH"),
  ]);
  for (const role of ["viewer", "employee"]) {
    const visible = maskState(state, role);
    assert(
      visible.shifts.every(
        (x) => x.code === "IN" && x.sicknessStatus === undefined,
      ),
    );
    assert.equal(summarize(visible, "2026-10")[0].absent, 480);
    assert.equal(visible.leaveCorrections, undefined);
  }
});

test("D04: Pages zachowuje wniosek i historię korekty po ponownym odczycie oraz przywróceniu", async () => {
  const state = fixture([
    { ...shift("u", "2026-10-15", "U"), requestStatus: "zaakceptowany" },
  ]);
  const map = new Map([
    [DEMO_STORAGE_KEY, JSON.stringify({ state, audit: [] })],
  ]);
  const storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
  const options = {
    body: JSON.stringify({
      revision: 0,
      kind: "shift",
      payload: {
        ...shift("ch", "2026-10-15", "CH"),
        sicknessStatus: "confirmed",
      },
    }),
  };
  await demoRequest("change", options, "hr", storage);
  const restoredRead = await demoRequest("state", {}, "hr", storage);
  assert.equal(restoredRead.leaveCorrections[0].restoredMinutes, 480);
  assert.equal(
    restoredRead.shifts.find((x) => x.id === "u").requestStatus,
    "zaakceptowany",
  );
  const audit = await demoRequest("audit", {}, "hr", storage);
  assert.match(audit[0].action, /Korekta urlopu/);
  const previous = await demoRequest(
    "change",
    {
      body: JSON.stringify({
        revision: 1,
        kind: "restore",
        payload: { id: audit[0].id },
        reason: "Test korekty CH",
      }),
    },
    "hr",
    storage,
  );
  assert.equal(leaveYearSummary(previous, "e0", "2026").used, 480);
  assert.equal(previous.shifts.length, 1);
  assert.equal((await demoRequest("audit", {}, "hr", storage)).length, 2);
});

test("D04: dwie potwierdzone daty CH przerywają całą nocną zmianę urlopową", () => {
  const state = fixture([
    shift("u", "2026-10-31", "U", "22:00", "06:00"),
    shift("ch1", "2026-10-31", "CH", "22:00", "06:00"),
    shift("ch2", "2026-11-01", "CH", "00:00", "06:00"),
  ]);
  const left = summarize(state, "2026-10")[0],
    right = summarize(state, "2026-11")[0];
  assert.equal(left.absent, 120);
  assert.equal(right.absent, 360);
  assert.equal(left.leave + right.leave, 0);
  assert.equal(left.interruptedLeave + right.interruptedLeave, 480);
  assert.equal(leaveYearSummary(state, "e0", "2026").restored, 480);
});

for (const [date, expected] of [
  ["2026-03-29", 300],
  ["2026-10-25", 420],
]) {
  test(`D04: choroba i urlop przy DST ${date} odliczają tylko ${expected} min`, () => {
    const state = fixture([
      shift("u", date, "U", "00:00", "06:00"),
      shift("ch", date, "CH", "00:00", "06:00"),
    ]);
    const sum = summarize(state, date.slice(0, 7))[0];
    assert.equal(sum.absent, expected);
    assert.equal(sum.interruptedLeave, expected);
    assert.equal(sum.leave, 0);
  });
}

test("D03: maskowanie przyczyny nie wyłącza kolizji całodziennej CH z pracą", () => {
  const state = fixture([
    shift("ch", "2026-10-15", "CH"),
    shift("p", "2026-10-15", "P", "15:00", "23:00"),
  ]);
  const visible = maskState(state, "viewer");
  assert.equal(conflicts(visible, "2026-10").length, 1);
  assert(!conflicts(visible, "2026-10")[0].detail.includes("CH"));
});
