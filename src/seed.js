import { DateTime } from "luxon";
import { dates, slots } from "./domain.js";
export function createSeed(makeId = () => globalThis.crypto.randomUUID()) {
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
        id: makeId(),
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
        id: makeId(),
        name: "Transmisja LIVE · mecz reprezentacji",
        date: "2026-10-14",
        start: "19:00",
        hours: 3,
        weight: 5,
        employeeId: "e4",
        skill: "LIVE",
      },
      {
        id: makeId(),
        name: "Koordynacja pasma wieczornego",
        date: "2026-10-16",
        start: "17:00",
        hours: 4,
        weight: 3,
        employeeId: "e5",
        skill: "Koordynacja",
      },
      {
        id: makeId(),
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
  return { ...seed, revision: 0 };
}
