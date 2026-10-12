import { DateTime } from "luxon";
import { validate } from "./domain.js";
export function maskState(state, role) {
  const s = structuredClone(state);
  if (["employee", "viewer"].includes(role)) {
    s.shifts = s.shifts.map((x) =>
      ["U", "UŻ", "CH", "UB", "IN"].includes(x.code)
        ? { ...x, code: "IN", originalCode: undefined }
        : x,
    );
    s.employees = s.employees.map(
      ({ leaveBalance, uzUsed, maxDaily, noNight, ...e }) => e,
    );
  }
  return s;
}
export function applyChange(
  state,
  { revision, kind, payload, reason },
  role,
  snapshot,
  makeId = () => globalThis.crypto.randomUUID(),
) {
  if (!["manager", "hr"].includes(role))
    throw Error("Ta rola ma dostęp tylko do odczytu.");
  if (revision !== state.revision)
    throw Error("Dane zostały zmienione. Odśwież widok przed ponowną edycją.");
  const s = structuredClone(state);
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
      id: prev?.id || makeId(),
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
    if (role !== "hr")
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
    s.tasks.push({ ...payload, id: payload.id || makeId() });
    action = "Aktualizacja zadania emisji";
  } else if (kind === "settings") {
    if (role !== "hr") throw Error("Ustawienia wymagają roli Kadry.");
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
    if (!snapshot) throw Error("Brak wersji.");
    Object.assign(s, structuredClone(snapshot), { revision });
    action = "Przywrócenie wersji: " + reason;
  } else throw Error("Nieznana operacja");
  return {
    state: { ...s, revision: state.revision + 1 },
    action: action + (reason ? " · " + reason : ""),
  };
}
