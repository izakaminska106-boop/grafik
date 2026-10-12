import test from "node:test";
import assert from "node:assert/strict";
import { validate } from "../src/domain.js";

function fixture(left = "2026-10-31", right = "2026-11-01", start = "07:00") {
  return {
    employees: [
      {
        id: "e0",
        name: "Pracownik testowy D12",
        fte: 1,
        leaveBalance: 12480,
        maxDaily: 720,
      },
    ],
    shifts: [
      {
        id: "left-d12",
        employeeId: "e0",
        date: left,
        code: "P",
        start: "15:00",
        end: "23:00",
      },
      {
        id: "right-d12",
        employeeId: "e0",
        date: right,
        code: "R",
        start,
        end: "18:00",
      },
    ],
    tasks: [],
    settings: {
      nightStart: "22:00",
      adjacentVerified: false,
      hrApproved: false,
      weekdayDemand: [],
      weekendDemand: [],
      holidayDemand: [],
    },
  };
}
const restErrors = (state, month) =>
  validate(state, month).filter((x) => x.rule === "Odpoczynek dobowy");

for (const [left, right] of [
  ["2026-10-31", "2026-11-01"],
  ["2026-12-31", "2027-01-01"],
]) {
  test(`D12: ${left}/${right}: 8 h zgłoszone w obu miesiącach z datami i pracownikiem`, () => {
    const state = fixture(left, right),
      original = structuredClone(state);
    for (const date of [left, right]) {
      const errors = restErrors(state, date.slice(0, 7));
      assert.equal(errors.length, 1);
      const error = errors[0];
      assert.equal(error.severity, "error");
      assert.equal(error.employee, "Pracownik testowy D12");
      assert.equal(error.date, date);
      assert.match(error.detail, /8 h odpoczynku; wymagane 11 h/);
      assert(error.detail.includes(left) && error.detail.includes(right));
      assert(error.detail.includes("23:00") && error.detail.includes("07:00"));
      assert(
        validate(state, date.slice(0, 7)).some(
          (x) => x.rule === "Niepełna walidacja",
        ),
      );
    }
    assert.deepEqual(state, original);
  });
  test(`D12: ${left}/${right}: dokładnie 11 h nie jest naruszeniem odpoczynku`, () => {
    const state = fixture(left, right, "10:00");
    state.settings.adjacentVerified = true;
    for (const date of [left, right]) {
      assert.equal(restErrors(state, date.slice(0, 7)).length, 0);
      assert(
        !validate(state, date.slice(0, 7)).some(
          (x) => x.rule === "Niepełna walidacja",
        ),
      );
    }
  });
}

test("D12: brak następnej zmiany pozostaje niepełną walidacją, bez tworzenia zmian", () => {
  const state = fixture();
  state.shifts.pop();
  const original = structuredClone(state);
  const result = validate(state, "2026-10");
  assert(
    result.some(
      (x) => x.rule === "Niepełna walidacja" && x.severity === "warning",
    ),
  );
  assert.equal(restErrors(state, "2026-10").length, 0);
  assert.deepEqual(state, original);
});

test("D12: obecność wpisów sąsiednich miesięcy nie potwierdza kompletności danych", () => {
  const state = fixture("2026-10-31", "2026-11-01", "10:00");
  assert.equal(restErrors(state, "2026-10").length, 0);
  assert(
    validate(state, "2026-10").some((x) => x.rule === "Niepełna walidacja"),
  );
});

test("D12: para spoza raportowanego miesiąca nie zgłasza naruszenia", () => {
  assert.equal(restErrors(fixture(), "2026-12").length, 0);
});

test("D12: pracownicy nie są łączeni w parę odpoczynku", () => {
  const state = fixture();
  state.employees.push({
    ...state.employees[0],
    id: "e1",
    name: "Drugi test D12",
  });
  state.shifts[1].employeeId = "e1";
  assert.equal(restErrors(state, "2026-10").length, 0);
  assert.equal(restErrors(state, "2026-11").length, 0);
});

for (const [left, right, hours] of [
  ["2026-03-28", "2026-03-29", 7],
  ["2026-10-24", "2026-10-25", 9],
]) {
  test(`D12: odpoczynek przy zmianie czasu ${left} wynosi ${hours} h`, () => {
    const error = restErrors(fixture(left, right), left.slice(0, 7))[0];
    assert.match(error.detail, new RegExp(`${hours} h odpoczynku`));
    assert(error.detail.includes(left) && error.detail.includes(right));
  });
}

test("D12: brak poprzedniej zmiany również nie potwierdza pełnej walidacji", () => {
  const state = fixture();
  state.shifts.shift();
  const original = structuredClone(state);
  assert.equal(restErrors(state, "2026-11").length, 0);
  assert(
    validate(state, "2026-11").some((x) => x.rule === "Niepełna walidacja"),
  );
  assert.deepEqual(state, original);
});

test("D12: nieposortowane wpisy w jednym miesiącu dają jedno naruszenie", () => {
  const state = fixture("2026-10-30", "2026-10-31");
  state.shifts.reverse();
  const original = structuredClone(state);
  assert.equal(restErrors(state, "2026-10").length, 1);
  assert.deepEqual(state, original);
});
