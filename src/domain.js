import { DateTime } from "luxon";
export const ZONE = "Europe/Warsaw";
export const slots = {
  R: ["07:00", "15:00"],
  P: ["15:00", "23:00"],
  WER: ["07:00", "15:00"],
  WEP: ["15:00", "23:00"],
  WEN: ["22:00", "06:00"],
};
export const absenceCodes = ["U", "UŻ", "CH", "UB", "IN"];
export function easter(year) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    n = h + l - 7 * m + 114;
  return DateTime.local(year, Math.floor(n / 31), (n % 31) + 1, { zone: ZONE });
}
export function holidays(year) {
  const e = easter(year);
  return [
    "01-01",
    "01-06",
    "05-01",
    "05-03",
    "08-15",
    "11-01",
    "11-11",
    "12-25",
    "12-26",
    ...(year >= 2025 ? ["12-24"] : []),
  ]
    .map((x) => `${year}-${x}`)
    .concat([
      e.toISODate(),
      e.plus({ days: 1 }).toISODate(),
      e.plus({ days: 49 }).toISODate(),
      e.plus({ days: 60 }).toISODate(),
    ]);
}
export function dates(month) {
  let d = DateTime.fromISO(month + "-01", { zone: ZONE });
  return Array.from({ length: d.daysInMonth }, (_, i) =>
    d.plus({ days: i }).toISODate(),
  );
}
export function nominal(month, fte = 1) {
  const hs = holidays(Number(month.slice(0, 4)));
  return (
    dates(month).filter(
      (d) => DateTime.fromISO(d).weekday <= 5 && !hs.includes(d),
    ).length *
    480 *
    fte
  );
}
export function interval(s) {
  let start = DateTime.fromISO(s.date + "T" + s.start, { zone: ZONE }),
    end = DateTime.fromISO(s.date + "T" + s.end, { zone: ZONE });
  if (end <= start) end = end.plus({ days: 1 });
  return { start, end };
}
export function minutes(s) {
  if (
    !s.start ||
    !s.end ||
    s.code === "W" ||
    (absenceCodes.includes(s.code) && s.originalCode === "W")
  )
    return 0;
  let { start, end } = interval(s);
  return Math.round(end.diff(start, "minutes").minutes);
}
export function nightMinutes(s, nightStart = "22:00") {
  if (!isWork(s)) return 0;
  const { start, end } = interval(s);
  let total = 0;
  for (
    let day = start.startOf("day").minus({ days: 1 });
    day < end;
    day = day.plus({ days: 1 })
  ) {
    let n = DateTime.fromISO(day.toISODate() + "T" + nightStart, {
        zone: ZONE,
      }),
      ne = n.plus({ days: 1 }).set({ hour: (n.hour + 8) % 24 });
    total +=
      Math.max(
        0,
        Math.min(end.toMillis(), ne.toMillis()) -
          Math.max(start.toMillis(), n.toMillis()),
      ) / 60000;
  }
  return Math.round(total);
}
export function effectiveAbsence(s) {
  return (
    absenceCodes.includes(s.code) &&
    (s.code === "CH" || !s.requestStatus || s.requestStatus === "zaakceptowany")
  );
}
export function isWork(s) {
  return (
    s.code !== "W" &&
    !effectiveAbsence(s) &&
    (!absenceCodes.includes(s.code) || s.originalCode !== "W")
  );
}
export function actualMinutes(s) {
  return absenceCodes.includes(s.code) && !effectiveAbsence(s)
    ? (s.originalActualMinutes ?? 0)
    : (s.actualMinutes ?? 0);
}
export function taskIsCovered(task, shift) {
  if (!isWork(shift)) return false;
  const start = DateTime.fromISO(task.date + "T" + task.start, { zone: ZONE }),
    end = start.plus({ minutes: task.hours * 60 }),
    work = interval(shift);
  return start.isValid && start >= work.start && end <= work.end;
}
export function summarize(state, month) {
  return state.employees.map((e) => {
    const ss = state.shifts.filter(
        (s) => s.employeeId === e.id && s.date.startsWith(month),
      ),
      work = ss.filter(isWork),
      abs = ss.filter(effectiveAbsence);
    let planned = work.reduce((a, s) => a + minutes(s), 0),
      absent = abs.reduce((a, s) => a + minutes(s), 0),
      actual = work.reduce((a, s) => a + actualMinutes(s), 0),
      leave = abs
        .filter((s) => ["U", "UŻ"].includes(s.code))
        .reduce((a, s) => a + minutes(s), 0);
    const points = state.tasks
      .filter(
        (t) =>
          t.employeeId === e.id &&
          t.date.startsWith(month) &&
          work.some((s) => taskIsCovered(t, s)),
      )
      .reduce((a, t) => a + t.hours * t.weight, 0);
    return {
      ...e,
      nominal: nominal(month, e.fte),
      planned,
      absent,
      actual,
      leave,
      night: work.reduce(
        (a, s) => a + nightMinutes(s, state.settings.nightStart),
        0,
      ),
      weekends: work.filter((s) => DateTime.fromISO(s.date).weekday > 5).length,
      points,
      uz: abs.filter((s) => s.code === "UŻ").length,
      ill: abs.filter((s) => s.code === "CH").length,
    };
  });
}
export function coverageIntervals(state, date, knownWork) {
  const weekend = DateTime.fromISO(date).weekday > 5,
    holiday = holidays(Number(date.slice(0, 4))).includes(date),
    req = holiday
      ? state.settings.holidayDemand
      : weekend
        ? state.settings.weekendDemand
        : state.settings.weekdayDemand;
  const needs = req.map((r) => {
    const i = interval({ date, ...r });
    return { start: i.start.toMillis(), end: i.end.toMillis(), count: r.count };
  });
  if (!needs.length) return [];
  const work =
    knownWork ||
    state.shifts
      .filter(isWork)
      .map((s) => ({ ...interval(s), employeeId: s.employeeId }))
      .map((s) => ({
        start: s.start.toMillis(),
        end: s.end.toMillis(),
        employeeId: s.employeeId,
      }));
  const start = Math.min(...needs.map((r) => r.start)),
    end = Math.max(...needs.map((r) => r.end));
  const result = [];
  for (let t = start; t < end; t += 60000) {
    const required = needs.reduce(
      (a, r) => a + (r.start <= t && r.end > t ? r.count : 0),
      0,
    );
    if (!required) continue;
    const available = new Set(
        work.filter((s) => s.start <= t && s.end > t).map((s) => s.employeeId),
      ).size,
      prev = result.at(-1);
    if (
      prev &&
      prev.required === required &&
      prev.available === available &&
      prev.end === t
    )
      prev.end = t + 60000;
    else result.push({ start: t, end: t + 60000, required, available });
  }
  return result;
}
export function coverage(state, month) {
  const work = state.shifts
    .filter(isWork)
    .map((s) => ({ ...interval(s), employeeId: s.employeeId }))
    .map((s) => ({
      start: s.start.toMillis(),
      end: s.end.toMillis(),
      employeeId: s.employeeId,
    }));
  return dates(month).map((date) => {
    const intervals = coverageIntervals(state, date, work);
    let required = 0,
      covered = 0,
      excess = 0;
    for (const i of intervals) {
      const mins = (i.end - i.start) / 60000;
      required += i.required * mins;
      covered += Math.min(i.required, i.available) * mins;
      excess += Math.max(0, i.available - i.required) * mins;
    }
    return {
      date,
      required,
      covered,
      gap: required - covered,
      excess,
      ratio: required ? covered / required : 1,
    };
  });
}
export function validate(state, month) {
  let out = [];
  const add = (severity, employee, date, rule, detail, basis, fix) =>
    out.push({ severity, employee, date, rule, detail, basis, fix });
  if (!state.settings.adjacentVerified)
    add(
      "warning",
      "Cały zespół",
      month,
      "Niepełna walidacja",
      "Brak potwierdzonych danych sąsiednich okresów i czterech tygodni niedziel.",
      "Art. 133 i 151¹² KP",
      "Uzupełnij dane okresów i przeprowadź kontrolę kadrową.",
    );
  if (!state.settings.hrApproved)
    add(
      "warning",
      "Cały zespół",
      month,
      "Profil oczekuje na kadry",
      "Profil zakładowy oraz reguły wyjątków nie zostały zatwierdzone.",
      "PRD §5",
      "Uzyskaj zatwierdzenie profilu i dodatkowych testów przez kadry.",
    );
  const summaries = summarize(state, month);
  for (const e of state.employees) {
    const all = state.shifts
      .filter((s) => s.employeeId === e.id && isWork(s))
      .sort((a, b) => interval(a).start - interval(b).start);
    for (let i = 0; i < all.length; i++) {
      const s = all[i],
        cur = interval(s);
      if (!s.date.startsWith(month)) continue;
      const len = minutes(s);
      if (len > Math.min(720, e.maxDaily ?? 720))
        add(
          "error",
          e.name,
          s.date,
          "Limit długości zmiany",
          `${len / 60} h; limit ${(e.maxDaily ?? 720) / 60} h.`,
          "Art. 135 i 148 KP",
          "Skróć planowaną zmianę do limitu profilu.",
        );
      if (e.noNight && nightMinutes(s, state.settings.nightStart) > 0)
        add(
          "error",
          e.name,
          s.date,
          "Ograniczenie pracy nocnej",
          "Zaplanowano pracę w porze nocnej.",
          "Profil indywidualny",
          "Przydziel zmianę dzienną.",
        );
      const prev = all[i - 1];
      if (prev) {
        const p = interval(prev),
          rest = cur.start.diff(p.end, "hours").hours;
        if (rest < 11)
          add(
            "error",
            e.name,
            s.date,
            rest < 0 ? "Nakładanie zmian" : "Odpoczynek dobowy",
            `${Math.round(rest * 100) / 100} h odpoczynku; wymagane 11 h.`,
            "Art. 132 KP",
            "Przesuń początek zmiany lub wybierz zastępstwo.",
          );
        if (cur.start < p.start.plus({ hours: 24 }))
          add(
            "error",
            e.name,
            s.date,
            "Doba pracownicza",
            "Kolejna zmiana rozpoczyna się w 24 h od poprzedniego rozpoczęcia.",
            "Art. 128 §3 KP",
            "Sprawdź rozkład i podstawę ewentualnego ruchomego czasu pracy.",
          );
      }
      if (
        state.shifts.some(
          (a) =>
            a.id !== s.id &&
            a.employeeId === e.id &&
            effectiveAbsence(a) &&
            interval(a).start < cur.end &&
            interval(a).end > cur.start,
        )
      )
        add(
          "error",
          e.name,
          s.date,
          "Praca podczas nieobecności",
          "Zmiana koliduje z nieobecnością.",
          "PRD §11",
          "Wyznacz zastępstwo.",
        );
    }
    const year = month.slice(0, 4),
      abs = state.shifts.filter(
        (s) =>
          s.employeeId === e.id &&
          s.date.startsWith(year) &&
          effectiveAbsence(s),
      ),
      used = abs
        .filter((s) => ["U", "UŻ"].includes(s.code))
        .reduce((a, s) => a + minutes(s), 0);
    if (used > e.leaveBalance)
      add(
        "error",
        e.name,
        month,
        "Saldo urlopu",
        `Przekroczenie puli o ${(used - e.leaveBalance) / 60} h.`,
        "Art. 152–168 KP",
        "Zweryfikuj zatwierdzone saldo z kadrami.",
      );
    if (abs.filter((s) => s.code === "UŻ").length + (e.uzUsed ?? 0) > 4)
      add(
        "error",
        e.name,
        month,
        "Limit urlopu na żądanie",
        "Przekroczono 4 dni w roku u wszystkich pracodawców.",
        "Art. 167² KP",
        "Zmień kategorię po decyzji kadr.",
      );
    const sum = summaries.find((x) => x.id === e.id);
    if (sum.planned > sum.nominal - sum.absent)
      add(
        "error",
        e.name,
        month,
        "Przekroczony wymiar planu",
        `${sum.planned / 60} h wobec ${(sum.nominal - sum.absent) / 60} h skorygowanego wymiaru.`,
        "Art. 130 KP",
        "Zbilansuj plan; nie planuj nadgodzin.",
      );
    // Weekly rest within the accounting period; boundary uncertainty remains explicit.
    const ds = dates(month);
    for (let i = 0; i + 7 <= ds.length; i += 7) {
      const ws = DateTime.fromISO(ds[i], { zone: ZONE }),
        we = ws.plus({ days: 7 });
      let ranges = all.map(interval).filter((s) => s.end > ws && s.start < we),
        cursor = ws,
        maxGap = 0;
      for (const r of ranges) {
        maxGap = Math.max(maxGap, r.start.diff(cursor, "hours").hours);
        if (r.end > cursor) cursor = r.end;
      }
      maxGap = Math.max(maxGap, we.diff(cursor, "hours").hours);
      if (maxGap < 35)
        add(
          "error",
          e.name,
          ds[i],
          "Odpoczynek tygodniowy",
          `Najdłuższa przerwa w tygodniu: ${Math.max(0, maxGap).toFixed(1)} h.`,
          "Art. 133 KP",
          "Zaplanuj co najmniej 35 h nieprzerwanego odpoczynku.",
        );
    }
  }
  for (const task of state.tasks.filter((t) => t.date.startsWith(month))) {
    const owner = state.employees.find((e) => e.id === task.employeeId);
    if (
      !state.shifts.some(
        (s) => s.employeeId === task.employeeId && taskIsCovered(task, s),
      )
    )
      add(
        "warning",
        owner?.name || "Cały zespół",
        task.date,
        "Zadanie poza czasem pracy",
        `${task.name}: ${task.start}, ${task.hours} h nie mieści się w przydzielonej pracy.`,
        "Plan operacyjny",
        "Przypisz zadanie do dostępnej osoby lub zaplanuj rzeczywistą pracę.",
      );
    if (!owner?.skills?.includes(task.skill))
      add(
        "warning",
        owner?.name || "Cały zespół",
        task.date,
        "Brak wymaganej kompetencji",
        `${task.name}: wymagana kompetencja ${task.skill}.`,
        "Profil kompetencji",
        "Wybierz osobę z odpowiednią kompetencją.",
      );
  }
  const cov = coverage(state, month),
    gap = cov.reduce((a, c) => a + c.gap, 0);
  if (gap)
    add(
      "warning",
      "Cały zespół",
      month,
      "Luki obsady",
      `${(gap / 60).toFixed(1)} wymaganych osobogodzin bez obsady.`,
      "Zapotrzebowanie operacyjne",
      "Uzupełnij obsadę lub zapisz jawną decyzję kierownika.",
    );
  add(
    "warning",
    "Cały zespół",
    month,
    "Rozliczenie wymaga kontroli kadr",
    "Niedziele, rekompensaty, szczególne uprawnienia i nadgodziny średniotygodniowe wymagają pełnego silnika rozliczeniowego.",
    "PRD §13",
    "Prototyp nie zatwierdza ani nie publikuje grafiku produkcyjnego.",
  );
  return out;
}
export function candidates(state, shift) {
  return state.employees
    .filter(
      (e) =>
        e.id !== shift.employeeId &&
        !state.shifts.some(
          (s) =>
            s.employeeId === e.id && s.date === shift.date && s.code !== "W",
        ),
    )
    .filter(
      (e) =>
        !validate(
          {
            ...state,
            shifts: [
              ...state.shifts,
              { ...shift, id: "candidate", employeeId: e.id },
            ],
          },
          shift.date.slice(0, 7),
        ).some((v) => v.severity === "error" && v.employee === e.name),
    );
}
