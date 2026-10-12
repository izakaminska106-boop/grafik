import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.GRAFIK_URL || "http://127.0.0.1:3001");
  await page.getByRole("heading", { name: "Pulpit zespołu" }).waitFor();
  assert(await page.getByText("1056 godzin wymiaru", { exact: false }).count());
  await page
    .getByRole("button", { name: "Otwórz grafik", exact: true })
    .click();
  await page.getByRole("button", { name: "Dodaj zmianę", exact: true }).click();
  await page.getByLabel("Data", { exact: true }).fill("2026-11-03");
  await page.getByLabel("Rodzaj wpisu").selectOption("CUSTOM");
  await page.getByLabel("Koniec", { exact: true }).fill("19:00");
  await page.getByRole("button", { name: "Zapisz wpis" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(await page.getByRole("status").getByText("Zapisano zmiany").count());
  await page
    .getByRole("button", { name: "Historia zmian", exact: true })
    .click();
  await page.getByText("Zmiana grafiku:", { exact: false }).first().waitFor();
  await page
    .getByRole("button", { name: "Przywróć poprzedni stan" })
    .first()
    .click();
  await page
    .getByLabel("Powód", { exact: true })
    .fill("Test przeglądarkowy: przywrócenie danych");
  await page
    .getByRole("button", { name: "Przywróć i zapisz historię" })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  for (const name of [
    "Zespół",
    "Nieobecności",
    "Zadania emisji",
    "Walidacja",
    "Ustawienia",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
  }
  await page.getByLabel("Rola demonstracyjna").selectOption("hr");
  await page.getByRole("button", { name: "Zespół", exact: true }).click();
  await page
    .getByRole("button", { name: "Otwórz kartę pracownika" })
    .first()
    .click();
  await page.getByLabel("Imię i nazwisko").waitFor();
  await page.getByRole("button", { name: "Zamknij", exact: true }).click();
  await page.getByRole("button", { name: "Pulpit", exact: true }).click();
  await page.screenshot({ path: "/tmp/grafik-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/grafik-mobile.png", fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Grafik emisji", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Grafik emisji", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: navigation, shift CRUD, history restore, roles, desktop and mobile; no browser errors.",
  );
} finally {
  await browser.close();
}
