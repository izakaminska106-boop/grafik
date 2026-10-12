import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  summarize,
  minutes,
  coverage,
  dayPeriod,
  minutesInPeriod,
  shiftPart,
} from "../src/domain.js";
import { createWorkbook } from "../src/export.js";

function fixture(date, start = "22:00", end = "06:00") {
  return {
    employees: [
      { id: "e0", name: "Test D02", fte: 1, leaveBalance: 12480, skills: [] },
    ],
    shifts: [
      {
        id: "one-shift-d02",
        version: 1,
        employeeId: "e0",
        date,
        code: "WEN",
        start,
        end,
        actualMinutes: null,
      },
    ],
    tasks: [],
    settings: {
      nightStart: "22:00",
      adjacentVerified: false,
      hrApproved: false,
      weekdayDemand: [],
      weekendDemand: [{ start: "22:00", end: "06:00", count: 1 }],
      holidayDemand: [],
    },
  };
}

for (const [date, left, right, before, after] of [
  ["2026-10-31", "2026-10", "2026-11", 120, 360],
  ["2026-12-31", "2026-12", "2027-01", 120, 360],
]) {
  test(`D02: ${date} 22–06, podsumowania obu miesięcy i jedno ID`, () => {
    const state = fixture(date),
      original = structuredClone(state);
    const first = summarize(state, left)[0],
      second = summarize(state, right)[0];
    assert.equal(first.planned, before);
    assert.equal(second.planned, after);
    assert.equal(first.night, before);
    assert.equal(second.night, after);
    assert.equal(first.planned + second.planned, minutes(state.shifts[0]));
    assert.deepEqual(state, original);
    assert.equal(state.shifts.length, 1);
    assert.equal(state.shifts[0].id, "one-shift-d02");
  });
  test(`D02: XLSX ${left}/${right} zawiera części tej samej zmiany`, async () => {
    const state = fixture(date);
    for (const [month, expected] of [
      [left, before],
      [right, after],
    ]) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(
        Buffer.from(await createWorkbook(state, month, "manager")),
      );
      const sheet = workbook.getWorksheet("Grafik"),
        headers = sheet.getRow(1).values;
      const column = (name) => headers.indexOf(name);
      assert.equal(sheet.rowCount, 2);
      assert.equal(
        sheet.getRow(2).getCell(column("ID_zmiany")).value,
        "one-shift-d02",
      );
      assert.equal(
        sheet.getRow(2).getCell(column("Plan_h")).value,
        expected / 60,
      );
      assert.equal(
        workbook.getWorksheet("Podsumowanie").getRow(2).getCell(3).value,
        expected / 60,
      );
    }
  });
}

test("D02: obsada nocna 31.10 jest liczona 2 h w październiku i 6 h w listopadzie", () => {
  const state = fixture("2026-10-31"),
    original = structuredClone(state);
  const october = coverage(state, "2026-10").at(-1),
    november = coverage(state, "2026-11")[0];
  assert.equal(october.required, 120);
  assert.equal(october.covered, 120);
  assert.equal(november.required, 360);
  assert.equal(november.covered, 360);
  assert.equal(october.gap + november.gap, 0);
  assert.deepEqual(state, original);
});

for (const [date, month, expected] of [
  ["2026-03-28", "2026-03", 420],
  ["2026-10-24", "2026-10", 540],
]) {
  test(`D02: rzeczywiste minuty WEN przy DST ${date}`, () => {
    const state = fixture(date);
    assert.equal(summarize(state, month)[0].planned, expected);
    assert.equal(summarize(state, month)[0].night, expected);
    assert.equal(minutes(state.shifts[0]), expected);
  });
}

test("D02: zakończenie dokładnie o północy nie tworzy czasu w następnym miesiącu", () => {
  const state = fixture("2026-10-31", "22:00", "00:00");
  assert.equal(summarize(state, "2026-10")[0].planned, 120);
  assert.equal(summarize(state, "2026-11")[0].planned, 0);
});

for (const [date, next, after] of [
  ["2026-03-28", "2026-03-29", 300],
  ["2026-10-24", "2026-10-25", 420],
]) {
  test(`D02: podział dzienny planu przy DST ${date}`, () => {
    const shift = fixture(date).shifts[0];
    assert.equal(minutesInPeriod(shift, dayPeriod(date)), 120);
    assert.equal(minutesInPeriod(shift, dayPeriod(next)), after);
    assert.equal(shiftPart(shift, dayPeriod(next)).id, shift.id);
    assert.equal(120 + after, minutes(shift));
    const state = fixture(date);
    state.settings.holidayDemand = state.settings.weekendDemand;
    const days = coverage(state, date.slice(0, 7));
    const current = days.find((d) => d.date === date);
    const following = days.find((d) => d.date === next);
    assert.equal(current.covered, 120);
    assert.equal(following.covered, after);
  });
}

test("D02: obsada przenosi noc z grudnia do stycznia, również na święto", () => {
  const state = fixture("2026-12-31");
  state.settings.weekdayDemand = state.settings.weekendDemand;
  const last = coverage(state, "2026-12").at(-1);
  const first = coverage(state, "2027-01")[0];
  assert.equal(last.covered, 120);
  assert.equal(first.covered, 360);
  assert.equal(first.required, 360);
  assert.equal(last.gap + first.gap, 360); // poprzednia noc bez pracownika
});

test("D02: wykonanie bez dat pozostaje przy starcie; oba raporty oznaczają brak podziału", async () => {
  const state = fixture("2026-10-31");
  state.shifts[0].actualMinutes = 480;
  for (const [month, planned, actual] of [
    ["2026-10", 120, 480],
    ["2026-11", 360, 0],
  ]) {
    const summary = summarize(state, month)[0];
    assert.equal(summary.planned, planned);
    assert.equal(summary.actual, actual);
    assert.equal(summary.actualAllocationIncomplete, true);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(await createWorkbook(state, month, "manager")),
    );
    const sheet = workbook.getWorksheet("Grafik");
    const column = (name) => sheet.getRow(1).values.indexOf(name);
    const row = sheet.getRow(2);
    assert.equal(row.getCell(column("Wykonanie_h")).value, actual ? 8 : null);
    assert.match(
      row.getCell(column("Uwagi_wykonanie")).value,
      /brak rzeczywistych dat/,
    );
    const from = row.getCell(column("Poczatek_w_okresie")).value;
    const to = row.getCell(column("Koniec_w_okresie")).value;
    assert.equal((Date.parse(to) - Date.parse(from)) / 60000, planned);
  }
  assert.equal(state.shifts.length, 1);
  assert.equal(state.shifts[0].actualMinutes, 480);
});

test("D02: nieznane wykonanie nie jest wyprowadzane z planu", async () => {
  const state = fixture("2026-10-31");
  for (const month of ["2026-10", "2026-11"]) {
    assert.equal(summarize(state, month)[0].actual, 0);
    assert.equal(summarize(state, month)[0].actualAllocationIncomplete, false);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(await createWorkbook(state, month, "manager")),
    );
    assert.equal(
      workbook.getWorksheet("Grafik").getRow(2).getCell(6).value,
      null,
    );
  }
});

test("D02: podstawa godzinowa nieobecności jest dzielona bez podwajania liczby dni", () => {
  const state = fixture("2026-10-31");
  state.shifts[0].code = "UŻ";
  const left = summarize(state, "2026-10")[0];
  const right = summarize(state, "2026-11")[0];
  assert.equal(left.planned + right.planned, 0);
  assert.equal(left.absent, 120);
  assert.equal(right.absent, 360);
  assert.equal(left.leave + right.leave, 480);
  assert.equal(left.uz + right.uz, 1);
});
