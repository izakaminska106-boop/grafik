import test from "node:test";
import assert from "node:assert/strict";
import {
  nominal,
  minutes,
  nightMinutes,
  validate,
  summarize,
  coverage,
} from "../src/domain.js";
const base = () => ({
  employees: [
    { id: "e0", name: "Test", fte: 1, leaveBalance: 208 * 60, maxDaily: 720 },
  ],
  shifts: [],
  tasks: [],
  settings: {
    nightStart: "22:00",
    adjacentVerified: false,
    hrApproved: false,
    weekdayDemand: [{ start: "07:00", end: "15:00", count: 1 }],
    weekendDemand: [],
    holidayDemand: [],
  },
});
const shift = (date, code, start, end) => ({
  id: date,
  employeeId: "e0",
  date,
  code,
  start,
  end,
});
test("Październik 176 h, listopad 160 h i zespół 1056 h", () => {
  assert.equal(nominal("2026-10"), 176 * 60);
  assert.equal(nominal("2026-11"), 160 * 60);
  assert.equal(nominal("2026-10") * 6, 1056 * 60);
});
test("Zmiana czasu Warszawa: 9 h jesienią, 7 h wiosną", () => {
  assert.equal(minutes(shift("2026-10-24", "WEN", "22:00", "06:00")), 540);
  assert.equal(minutes(shift("2026-03-28", "WEN", "22:00", "06:00")), 420);
});
test("P → R: 8 h odpoczynku i naruszenie doby", () => {
  const s = base();
  s.shifts = [
    shift("2026-10-01", "P", "15:00", "23:00"),
    shift("2026-10-02", "R", "07:00", "15:00"),
  ];
  const v = validate(s, "2026-10");
  assert(
    v.some((x) => x.rule === "Odpoczynek dobowy" && x.detail.includes("8 h")),
  );
  assert(v.some((x) => x.rule === "Doba pracownicza"));
});
test("Kontrola doby przy zachowanym 11 h odstępie", () => {
  const s = base();
  s.shifts = [
    shift("2026-10-01", "CUSTOM", "12:00", "16:00"),
    shift("2026-10-02", "R", "07:00", "15:00"),
  ];
  const v = validate(s, "2026-10");
  assert(!v.some((x) => x.rule === "Odpoczynek dobowy"));
  assert(v.some((x) => x.rule === "Doba pracownicza"));
});
test("12 h jest dozwolone; 13 h blokuje plan", () => {
  const s = base();
  s.shifts = [shift("2026-10-01", "CUSTOM", "07:00", "19:00")];
  assert(
    !validate(s, "2026-10").some((x) => x.rule === "Limit długości zmiany"),
  );
  s.shifts[0].end = "20:00";
  assert(
    validate(s, "2026-10").some((x) => x.rule === "Limit długości zmiany"),
  );
});
test("Urlop 10 h i UŻ 12 h zachowują godziny, nie są pracą", () => {
  const s = base();
  s.shifts = [
    shift("2026-10-01", "U", "07:00", "17:00"),
    shift("2026-10-02", "UŻ", "07:00", "19:00"),
  ];
  const e = summarize(s, "2026-10")[0];
  assert.equal(e.leave, 1320);
  assert.equal(e.planned, 0);
  assert.equal(e.actual, 0);
  assert.equal(e.uz, 1);
});
test("Piąty UŻ wywołuje błąd", () => {
  const s = base();
  s.shifts = Array.from({ length: 5 }, (_, i) =>
    shift(`2026-10-0${i + 1}`, "UŻ", "07:00", "19:00"),
  );
  assert(
    validate(s, "2026-10").some((x) => x.rule === "Limit urlopu na żądanie"),
  );
});
test("CH na 12 h i dniu wolnym: 2 dni, 12 h", () => {
  const s = base();
  s.shifts = [
    shift("2026-10-01", "CH", "07:00", "19:00"),
    shift("2026-10-02", "CH", "00:00", "00:00"),
  ];
  s.shifts[1].originalCode = "W";
  const e = summarize(s, "2026-10")[0];
  assert.equal(e.ill, 2);
  assert.equal(e.absent, 720);
  assert.equal(e.actual, 0);
});
test("Brak sąsiednich okresów nigdy nie jest zgodnością", () =>
  assert(
    validate(base(), "2026-10").some((x) => x.rule === "Niepełna walidacja"),
  ));
test("Godziny nocne liczone również na zmianie P", () =>
  assert.equal(nightMinutes(shift("2026-10-01", "P", "15:00", "23:00")), 60));
test("Pokrycie nie przekracza 100%, nadmiar osobno", () => {
  const s = base();
  s.shifts = [
    shift("2026-10-01", "R", "07:00", "15:00"),
    {
      ...shift("2026-10-01", "R", "07:00", "15:00"),
      id: "extra",
      employeeId: "e1",
    },
  ];
  const c = coverage(s, "2026-10")[0];
  assert.equal(c.ratio, 1);
  assert.equal(c.excess, 480);
});
test("Waga zadania zmienia punkty, nie godziny", () => {
  const s = base();
  s.shifts = [shift("2026-10-01", "R", "07:00", "15:00")];
  s.tasks = [
    {
      employeeId: "e0",
      date: "2026-10-01",
      hours: 2,
      weight: 3,
      start: "08:00",
    },
  ];
  let a = summarize(s, "2026-10")[0];
  s.tasks[0].weight = 5;
  let b = summarize(s, "2026-10")[0];
  assert.equal(a.planned, b.planned);
  assert.equal(b.points, 10);
});

test("Niezaakceptowany wniosek nie obniża wymiaru", () => {
  const s = base();
  s.shifts = [
    {
      ...shift("2026-10-01", "U", "07:00", "15:00"),
      requestStatus: "zgłoszony",
    },
  ];
  assert.equal(summarize(s, "2026-10")[0].absent, 0);
});

test("Nakładanie przedziałów zapotrzebowania sumuje potrzebę, nie dubluje pokrycia", () => {
  const s = base();
  s.settings.weekdayDemand = [
    { start: "15:00", end: "23:00", count: 1 },
    { start: "22:00", end: "06:00", count: 1 },
  ];
  s.shifts = [shift("2026-10-01", "P", "15:00", "23:00")];
  const c = coverage(s, "2026-10")[0];
  assert.equal(c.required, 960);
  assert.equal(c.covered, 480);
  assert.equal(c.gap, 480);
});

test("Pora nocna podczas zmiany czasu obejmuje faktyczne 9 lub 7 h", () => {
  assert.equal(nightMinutes(shift("2026-10-24", "WEN", "22:00", "06:00")), 540);
  assert.equal(nightMinutes(shift("2026-03-28", "WEN", "22:00", "06:00")), 420);
});
test("Wniosek zgłoszony zachowuje pierwotną planowaną pracę", () => {
  const s = base();
  s.shifts = [
    {
      ...shift("2026-10-01", "U", "07:00", "15:00"),
      requestStatus: "zgłoszony",
      originalCode: "R",
    },
  ];
  const e = summarize(s, "2026-10")[0];
  assert.equal(e.planned, 480);
  assert.equal(e.absent, 0);
  assert.equal(coverage(s, "2026-10")[0].covered, 480);
});

test("Dwa przydziały tej samej osoby nie zwiększają obsady", () => {
  const s = base();
  s.settings.weekdayDemand = [{ start: "07:00", end: "15:00", count: 2 }];
  s.shifts = [
    shift("2026-10-01", "R", "07:00", "15:00"),
    { ...shift("2026-10-01", "R", "07:00", "15:00"), id: "overlap" },
  ];
  const c = coverage(s, "2026-10")[0];
  assert.equal(c.ratio, 0.5);
  assert(validate(s, "2026-10").some((x) => x.rule === "Nakładanie zmian"));
});

test("Zadanie podczas urlopu nie nalicza punktów i daje ostrzeżenie", () => {
  const s = base();
  s.shifts = [shift("2026-10-01", "U", "07:00", "15:00")];
  s.tasks = [
    {
      name: "LIVE",
      employeeId: "e0",
      date: "2026-10-01",
      start: "08:00",
      hours: 2,
      weight: 5,
      skill: "LIVE",
    },
  ];
  assert.equal(summarize(s, "2026-10")[0].points, 0);
  assert(
    validate(s, "2026-10").some((x) => x.rule === "Zadanie poza czasem pracy"),
  );
});
