import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
const dir = process.env.GRAFIK_DATA_DIR || ".data";
mkdirSync(path.join(dir, "backups"), { recursive: true });
const destination = path.resolve(
  dir,
  "backups",
  `grafik-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
const db = new DatabaseSync(path.join(dir, "grafik.sqlite"));
db.exec(`VACUUM INTO '${destination.replaceAll("'", "''")}'`);
db.close();
console.log("Utworzono spójną kopię SQLite w katalogu backups.");
