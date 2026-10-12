import { createSeed } from "./seed.js";
import { applyChange, maskState } from "./operations.js";
export const DEMO_STORAGE_KEY = "grafik-emisji-pages-v1";
function read(storage = localStorage) {
  const value = storage.getItem(DEMO_STORAGE_KEY);
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed.state || !Array.isArray(parsed.audit)) throw Error();
      return parsed;
    } catch {
      throw Error(
        "Nie można odczytać danych demonstracji w tej przeglądarce. Wyczyść dane tej witryny, aby rozpocząć od nowa.",
      );
    }
  }
  const initial = { state: createSeed(), audit: [] };
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}
export async function demoRequest(
  path,
  options = {},
  role = "manager",
  storage = localStorage,
) {
  if (!["manager", "hr", "employee", "viewer"].includes(role))
    throw Error("Nieznana rola");
  if (path === "state") return maskState(read(storage).state, role);
  if (path === "audit") {
    if (!["manager", "hr"].includes(role)) throw Error("Brak uprawnień");
    return read(storage)
      .audit.map(({ snapshot, ...entry }) => entry)
      .reverse();
  }
  if (path !== "change") throw Error("Nieznana operacja demonstracyjna");
  const save = () => {
    const data = read(storage),
      body = JSON.parse(options.body),
      snapshot = data.audit.find((a) => a.id === body.payload?.id)?.snapshot;
    const result = applyChange(data.state, body, role, snapshot);
    const id = (data.audit.at(-1)?.id || 0) + 1;
    const audit = [
      ...data.audit,
      {
        id,
        time: new Date().toISOString(),
        role,
        action: result.action,
        snapshot: data.state,
      },
    ].slice(-20);
    // One storage write commits both state and its previous version.
    storage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({ state: result.state, audit }),
    );
    return maskState(result.state, role);
  };
  if (typeof window !== "undefined" && navigator.locks)
    return navigator.locks.request(DEMO_STORAGE_KEY, save);
  return save();
}
export async function exportDemo(month, role) {
  const { createWorkbook } = await import("./export.js");
  const data = await createWorkbook(read().state, month, role);
  return new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
