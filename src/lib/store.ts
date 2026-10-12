import fs from "node:fs";
import path from "node:path";
import type { DB } from "./types";

/**
 * Single-process store: the whole tournament lives in memory and is flushed to
 * data/db.json. Run the app as one long-lived Node server (`next start`).
 */
const FILE = path.join(process.cwd(), "data", "db.json");

type Holder = { db: DB; timer: NodeJS.Timeout | null };
const g = globalThis as unknown as { __pwStore?: Holder };

function load(): DB {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as DB;
    if (parsed && parsed.version === 1) return parsed;
  } catch {}
  return { version: 1, teams: [], matches: [] };
}

function holder(): Holder {
  if (!g.__pwStore) g.__pwStore = { db: load(), timer: null };
  return g.__pwStore;
}

export function db(): DB {
  return holder().db;
}

export function save() {
  const h = holder();
  if (h.timer) return;
  h.timer = setTimeout(() => {
    h.timer = null;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      const tmp = FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(h.db));
      fs.renameSync(tmp, FILE);
    } catch (e) {
      console.error("[store] failed to persist", e);
    }
  }, 250);
}

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
