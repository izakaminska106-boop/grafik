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
  const days = dates(month);
  const weekdays = days.filter((d) => DateTime.fromISO(d).weekday <= 5).length;
  const nonSundayHolidays = days.filter(
    (d) => hs.includes(d) && DateTime.fromISO(d).weekday !== 7,
  ).length;
  return (weekdays - nonSundayHolidays) * 480 * fte;
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
export function monthPeriod(month) {
  const start = DateTime.fromISO(month + "-01", { zone: ZONE });
  return { start, end: start.plus({ months: 1 }) };
}
export function dayPeriod(date) {
  const start = DateTime.fromISO(date, { zone: ZONE });
  return { start, end: start.plus({ days: 1 }) };
}
// A plan reporting fragment, never a second stored shift. Actual execution
// cannot be split without its own start/end timestamps.
export function shiftPart(s, period) {
  if (!(minutes(s) > 0)) return null;
  const full = interval(s);
  const start = DateTime.max(full.start, period.start);
  const end = DateTime.min(full.end, period.end);
  if (!(end > start)) return null;
  return {
    id: s.id,
    start,
    end,
    minutes: Math.round(end.diff(start, "minutes").minutes),
  };
}
export function minutesInPeriod(s, period) {
  return shiftPart(s, period)?.minutes ?? 0;
}
export function belongsToMonth(s, month) {
  return s.date.startsWith(month) || minutesInPeriod(s, monthPeriod(month)) > 0;
}
export function nightMinutes(s, nightStart = "22:00", period) {
  if (!isWork(s)) return 0;
  const full = interval(s);
  const start = period ? DateTime.max(full.start, period.start) : full.start;
  const end = period ? DateTime.min(full.end, period.end) : full.end;
  if (!(end > start)) return 0;
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
export function confirmedSickness(s) {
  // Legacy CH entries were registered as confirmed absence (PRD §6).
  return s.code === "CH" && (s.sicknessStatus ?? "confirmed") === "confirmed";
}
export function effectiveAbsence(s) {
  if (typeof s.accountingIsAbsence === "boolean") return s.accountingIsAbsence;
  return (
    absenceCodes.includes(s.code) &&
    (s.code === "CH"
      ? confirmedSickness(s)
      : !s.requestStatus || s.requestStatus === "zaakceptowany")
  );
}
export function isWork(s) {
  if (typeof s.accountingIsWork === "boolean") return s.accountingIsWork;
  return (
    s.code !== "W" &&
    !(
      s.code === "CH" &&
      !confirmedSickness(s) &&
      (!s.originalCode || s.sourceLeaveId)
    ) &&
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
// CH covers its calendar date; start/end remain the lost planned-hours basis.
export function absenceInterval(s) {
  if (s.accountingAbsenceInterval)
    return {
      start: DateTime.fromISO(s.accountingAbsenceInterval.start),
      end: DateTime.fromISO(s.accountingAbsenceInterval.end),
    };
  return s.code === "CH" ? dayPeriod(s.date) : interval(s);
}
const overlaps = (a, b) => a.start < b.end && a.end > b.start;
export function sicknessLeaveConflicts(state) {
  const sick = state.shifts.filter(confirmedSickness);
  const leave = state.shifts.filter(
    (s) => ["U", "UŻ"].includes(s.code) && effectiveAbsence(s),
  );
  return leave.flatMap((l) =>
    sick
      .filter(
        (ch) =>
          ch.employeeId === l.employeeId &&
          (ch.date === l.date || overlaps(dayPeriod(ch.date), interval(l))),
      )
      .map((ch) => ({
        sick: ch,
        leave: l,
        disputed: dayPeriod(ch.date),
      })),
  );
}
export function absenceAccountingIntervals(s, conflicts) {
  if (s.accountingIntervals)
    return s.accountingIntervals.map((r) => ({
      start: DateTime.fromISO(r.start),
      end: DateTime.fromISO(r.end),
    }));
  if (!effectiveAbsence(s) || !(minutes(s) > 0)) return [];
  const basisPeriod = s.code === "CH" ? dayPeriod(s.date) : interval(s);
  const part = shiftPart(s, basisPeriod);
  if (!part) return [];
  const excluded = conflicts
    .filter((c) => c.leave.id === s.id)
    .map((c) => ({
      start: DateTime.max(part.start, c.disputed.start),
      end: DateTime.min(part.end, c.disputed.end),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const result = [];
  let cursor = part.start;
  for (const r of excluded) {
    if (r.start > cursor) result.push({ start: cursor, end: r.start });
    cursor = DateTime.max(cursor, r.end);
  }
  if (part.end > cursor) result.push({ start: cursor, end: part.end });
  return result;
}
export function absenceMinutesInPeriod(s, period, conflicts) {
  // Confirmed CH interrupts leave only within its calendar date. The source
  // request remains intact; its hours outside the CH date stay charged.
  return Math.round(
    absenceAccountingIntervals(s, conflicts).reduce(
      (total, r) =>
        total +
        Math.max(
          0,
          DateTime.min(r.end, period.end).toMillis() -
            DateTime.max(r.start, period.start).toMillis(),
        ) /
          60000,
      0,
    ),
  );
}
export function absenceReviewInPeriod(conflicts, period) {
  return conflicts.some(
    (c) =>
      overlaps(interval(c.leave), period) ||
      overlaps(dayPeriod(c.sick.date), period),
  );
}
export function leaveYearSummary(
  state,
  employeeId,
  year,
  conflicts = sicknessLeaveConflicts(state),
) {
  const start = DateTime.fromISO(year + "-01-01", { zone: ZONE });
  const period = { start, end: start.plus({ years: 1 }) };
  const relevant = conflicts.filter((c) => c.leave.employeeId === employeeId);
  const leave = state.shifts.filter(
    (s) =>
      s.employeeId === employeeId &&
      s.date.startsWith(year) &&
      ["U", "UŻ"].includes(s.code) &&
      effectiveAbsence(s),
  );
  const used = leave.reduce(
    (a, s) =>
      a +
      absenceMinutesInPeriod(
        s,
        { start: interval(s).start, end: interval(s).end },
        relevant,
      ),
    0,
  );
  return {
    used,
    restored: leave.reduce((a, s) => a + minutes(s), 0) - used,
    interrupted: absenceReviewInPeriod(relevant, period),
  };
}
export function summarize(state, month) {
  const period = monthPeriod(month),
    conflicts = sicknessLeaveConflicts(state);
  return state.employees.map((e) => {
    const ss = state.shifts.filter(
        (s) => s.employeeId === e.id && belongsToMonth(s, month),
      ),
      work = ss.filter(isWork),
      abs = ss.filter(effectiveAbsence);
    let planned = work.reduce((a, s) => a + minutesInPeriod(s, period), 0),
      absent = abs.reduce(
        (a, s) => a + absenceMinutesInPeriod(s, period, conflicts),
        0,
      ),
      actual = work
        .filter((s) => s.date.startsWith(month))
        .reduce((a, s) => a + actualMinutes(s), 0),
      leave = abs
        .filter((s) => ["U", "UŻ"].includes(s.code))
        .reduce((a, s) => a + absenceMinutesInPeriod(s, period, conflicts), 0);
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
      leaveInterrupted: absenceReviewInPeriod(
        conflicts.filter((c) => c.leave.employeeId === e.id),
        period,
      ),
      interruptedLeave:
        abs
          .filter((s) => ["U", "UŻ"].includes(s.code))
          .reduce((a, s) => a + minutesInPeriod(s, period), 0) - leave,
      actual,
      actualAllocationIncomplete: work.some(
        (s) =>
          actualMinutes(s) > 0 && minutesInPeriod(s, period) !== minutes(s),
      ),
      leave,
      night: work.reduce(
        (a, s) => a + nightMinutes(s, state.settings.nightStart, period),
        0,
      ),
      weekends: work.filter(
        (s) => s.date.startsWith(month) && DateTime.fromISO(s.date).weekday > 5,
      ).length,
      points,
      uz: abs.filter((s) => s.date.startsWith(month) && s.code === "UŻ").length,
      ill: abs.filter((s) => s.date.startsWith(month) && s.code === "CH")
        .length,
    };
  });
}
export function coverageIntervals(state, date, knownWork) {
  const period = dayPeriod(date);
  // Include yesterday's overnight requirements, then clip all demand to this
  // calendar day. Overlapping requirements remain additive, as before.
  const sourceDates = [period.start.minus({ days: 1 }).toISODate(), date];
  const needs = sourceDates.flatMap((sourceDate) => {
    const weekend = DateTime.fromISO(sourceDate).weekday > 5;
    const holiday = holidays(Number(sourceDate.slice(0, 4))).includes(
      sourceDate,
    );
    const req = holiday
      ? state.settings.holidayDemand
      : weekend
        ? state.settings.weekendDemand
        : state.settings.weekdayDemand;
    return req
      .map((r) => {
        const i = interval({ date: sourceDate, ...r });
        return {
          start: Math.max(i.start.toMillis(), period.start.toMillis()),
          end: Math.min(i.end.toMillis(), period.end.toMillis()),
          count: r.count,
        };
      })
      .filter((r) => r.end > r.start);
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
  const period = monthPeriod(month),
    conflicts = sicknessLeaveConflicts(state);
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
  for (const s of state.shifts.filter(
    (s) => s.code === "CH" && !confirmedSickness(s) && s.date.startsWith(month),
  ))
    add(
      "warning",
      state.employees.find((e) => e.id === s.employeeId)?.name ?? "Cały zespół",
      s.date,
      "Wymaga weryfikacji przez kadry",
      `Niepotwierdzone zgłoszenie choroby ${s.id}, ${s.date}. Nie przerywa automatycznie urlopu i nie odlicza godzin CH.`,
      "PRD §6",
      "Kadry potwierdzają okres niezdolności do pracy przed rozliczeniem.",
    );
  const summaries = summarize(state, month);
  for (const e of state.employees) {
    const all = state.shifts
      .filter((s) => s.employeeId === e.id && isWork(s))
      .sort((a, b) => interval(a).start - interval(b).start);
    for (let i = 0; i < all.length; i++) {
      const s = all[i],
        cur = interval(s);
      const prev = all[i - 1],
        p = prev ? interval(prev) : null;
      // Check both ends of a pair before filtering month-local rules.
      // Reading adjacent shifts does not establish completeness of the data.
      if (prev && (s.date.startsWith(month) || prev.date.startsWith(month))) {
        const rest = cur.start.diff(p.end, "hours").hours;
        if (rest < 11)
          add(
            "error",
            e.name,
            s.date.startsWith(month) ? s.date : prev.date,
            rest < 0 ? "Nakładanie zmian" : "Odpoczynek dobowy",
            `${Math.round(rest * 100) / 100} h odpoczynku; wymagane 11 h. Od ${p.end.toISO()} do ${cur.start.toISO()} (Europe/Warsaw).`,
            "Art. 132 KP",
            "Przesuń początek zmiany lub wybierz zastępstwo.",
          );
      }
      const collidingAbsences = state.shifts.filter(
        (a) =>
          a.id !== s.id &&
          a.employeeId === e.id &&
          effectiveAbsence(a) &&
          overlaps(absenceInterval(a), cur) &&
          (a.code === "CH" || a.accountingAbsenceInterval
            ? belongsToMonth(s, month)
            : s.date.startsWith(month)),
      );
      if (collidingAbsences.length)
        add(
          "error",
          e.name,
          s.date.startsWith(month) ? s.date : collidingAbsences[0].date,
          "Praca podczas nieobecności",
          `Zmiana ${s.id}: ${cur.start.toISO()}–${cur.end.toISO()} koliduje z nieobecnością: ${collidingAbsences.map((a) => `${a.code} ${a.date}${a.code === "CH" ? " (cały dzień kalendarzowy)" : ""}`).join(", ")}.`,
          "PRD §6 i §11",
          "Wyznacz zastępstwo; zachowaj pierwotny plan i historię.",
        );
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
      if (prev) {
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
    }
    const year = month.slice(0, 4),
      abs = state.shifts.filter(
        (s) =>
          s.employeeId === e.id &&
          s.date.startsWith(year) &&
          effectiveAbsence(s),
      ),
      used = leaveYearSummary(state, e.id, year, conflicts).used;
    for (const conflict of conflicts.filter(
      (c) => c.leave.employeeId === e.id && absenceReviewInPeriod([c], period),
    ))
      add(
        "warning",
        e.name,
        conflict.sick.date.startsWith(month)
          ? conflict.sick.date
          : conflict.leave.date,
        "Urlop przerwany z powodu choroby",
        `CH ${conflict.sick.date} (ID ${conflict.sick.id}) koliduje z ${conflict.leave.code} ${conflict.leave.date} (ID ${conflict.leave.id}). Urlop przerwany z powodu choroby — art. 166 Kodeksu pracy. Godziny urlopu objęte CH nie pomniejszają salda; pierwotny wniosek pozostaje w historii.`,
        "Art. 166 KP; PRD §6",
        "Kadry weryfikują rozliczenie i ustalają termin niewykorzystanego urlopu; bez automatycznego przedłużenia.",
      );
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
