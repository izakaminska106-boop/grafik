import ExcelJS from "exceljs";
import {
  slots,
  summarize,
  validate,
  monthPeriod,
  shiftPart,
  minutesInPeriod,
  belongsToMonth,
  isWork,
  effectiveAbsence,
  minutes,
  sicknessLeaveConflicts,
  absenceMinutesInPeriod,
  leaveYearSummary,
  confirmedSickness,
} from "./domain.js";
export async function createWorkbook(s, month, role) {
  const period = monthPeriod(month),
    conflicts = sicknessLeaveConflicts(s);
  const wb = new ExcelJS.Workbook(),
    sensitive = ["manager", "hr"].includes(role);
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
      .filter((x) => belongsToMonth(x, month))
      .map((x) => {
        const part = shiftPart(x, period);
        return {
          Pracownik: s.employees.find((e) => e.id === x.employeeId)?.name,
          Data: x.date,
          Kod:
            !sensitive && ["U", "UŻ", "CH", "UB", "IN"].includes(x.code)
              ? "Nieobecność"
              : x.code,
          Od: x.start,
          Do: x.end,
          Wykonanie_h:
            !x.date.startsWith(month) || x.actualMinutes === null
              ? null
              : (x.actualMinutes ?? 0) / 60,
          Plan_h: isWork(x) ? minutesInPeriod(x, period) / 60 : 0,
          ID_zmiany: x.id,
          Poczatek_w_okresie: part?.start.toISO() ?? null,
          Koniec_w_okresie: part?.end.toISO() ?? null,
          Nieobecnosci_h: effectiveAbsence(x)
            ? absenceMinutesInPeriod(x, period, conflicts) / 60
            : 0,
          Podstawa_nieobecnosci_h: effectiveAbsence(x)
            ? minutesInPeriod(x, period) / 60
            : 0,
          [sensitive ? "Urlop_przerwany_h" : "Korekta_nieobecnosci_h"]:
            ["U", "UŻ"].includes(x.code) && effectiveAbsence(x)
              ? (minutesInPeriod(x, period) -
                  absenceMinutesInPeriod(x, period, conflicts)) /
                60
              : 0,
          Status_nieobecnosci: !sensitive
            ? ""
            : x.code === "CH"
              ? confirmedSickness(x)
                ? "Potwierdzona choroba — wskazany dzień kalendarzowy"
                : "Wymaga weryfikacji przez kadry"
              : conflicts.some((c) => c.leave.id === x.id)
                ? "Urlop przerwany z powodu choroby — art. 166 Kodeksu pracy"
                : "",
          Pierwotna_data: sensitive ? (x.originalDate ?? null) : null,
          Pierwotny_kod: sensitive ? (x.originalCode ?? null) : null,
          Pierwotny_plan_od: sensitive ? (x.originalStart ?? null) : null,
          Pierwotny_plan_do: sensitive ? (x.originalEnd ?? null) : null,
          Uwagi_wykonanie:
            x.actualMinutes > 0 && minutesInPeriod(x, period) !== minutes(x)
              ? "Wykonanie bez podziału miesięcznego — brak rzeczywistych dat rozpoczęcia i zakończenia."
              : "",
        };
      }),
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
      [sensitive ? "Urlop_przerwany_h" : "Korekta_nieobecnosci_h"]:
        x.interruptedLeave / 60,
      Saldo_urlopu_roczne_h:
        sensitive && x.leaveBalance !== undefined
          ? (x.leaveBalance -
              leaveYearSummary(s, x.id, month.slice(0, 4), conflicts).used) /
            60
          : null,
      Status_urlopu:
        sensitive && x.leaveInterrupted
          ? "Urlop przerwany z powodu choroby — art. 166 Kodeksu pracy"
          : "",
      Status_wykonania: x.actualAllocationIncomplete
        ? "Bez podziału zmiany między miesiące"
        : "",
    })),
  );
  add(
    "Walidacja",
    validate(s, month).map((v) => {
      if (sensitive) return v;
      if (v.rule === "Urlop przerwany z powodu choroby")
        return {
          ...v,
          rule: "Korekta rozliczenia nieobecności",
          detail:
            "Godziny nieobecności skorygowano. Szczegóły dostępne Kadrom.",
          basis: "PRD §6",
          fix: "Zweryfikuj rozliczenie z Kadrami.",
        };
      if (v.rule === "Praca podczas nieobecności")
        return {
          ...v,
          detail: "Zmiana koliduje z potwierdzoną nieobecnością.",
        };
      if (v.rule === "Wymaga weryfikacji przez kadry")
        return {
          ...v,
          detail: "Niepotwierdzone zgłoszenie nieobecności wymaga weryfikacji.",
        };
      return v;
    }),
  );
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
  return wb.xlsx.writeBuffer();
}
