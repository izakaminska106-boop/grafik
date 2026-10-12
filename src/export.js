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
} from "./domain.js";
export async function createWorkbook(s, month, role) {
  const period = monthPeriod(month);
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
            ? minutesInPeriod(x, period) / 60
            : 0,
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
      Status_wykonania: x.actualAllocationIncomplete
        ? "Bez podziału zmiany między miesiące"
        : "",
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
  return wb.xlsx.writeBuffer();
}
