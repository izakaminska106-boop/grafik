import ExcelJS from "exceljs";
import { slots, summarize, validate } from "./domain.js";
export async function createWorkbook(s, month, role) {
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
      .filter((x) => x.date.startsWith(month))
      .map((x) => ({
        Pracownik: s.employees.find((e) => e.id === x.employeeId)?.name,
        Data: x.date,
        Kod:
          !sensitive && ["U", "UŻ", "CH", "UB", "IN"].includes(x.code)
            ? "Nieobecność"
            : x.code,
        Od: x.start,
        Do: x.end,
        Wykonanie_h:
          x.actualMinutes === null ? null : (x.actualMinutes ?? 0) / 60,
      })),
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
