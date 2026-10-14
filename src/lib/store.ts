import fs from "node:fs";
import path from "node:path";
import type { DB, Match, Team } from "./types";

/*
 * Storage.
 *
 * With Upstash Redis configured (KV_REST_API_URL / UPSTASH_REDIS_REST_URL),
 * every server instance shares one store, so the app works on serverless hosts
 * like Vercel where requests land on different instances. Teams live in one
 * "meta" doc, each match in its own doc, and a version hash lets an instance
 * refetch only what changed. Writes take a short per-doc lock and re-read the
 * doc first, so two instances never overwrite each other.
 *
 * Without Redis it falls back to one in-process store flushed to data/db.json,
 * which needs a single long-lived Node server (`next start`).
 */

interface Meta {
  teams: Team[];
  matchIds: string[];
}
type Entry<T> = { ver: string; data: T };
type Cache = { meta: Entry<Meta>; matches: Map<string, Entry<Match>> };

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const sharedStore = () => !!(REDIS_URL && REDIS_TOKEN);

const FILE = path.join(process.cwd(), "data", "db.json");
const K = { meta: "pw:meta", vers: "pw:vers", match: (id: string) => `pw:m:${id}`, lock: (n: string) => `pw:lock:${n}` };

const g = globalThis as unknown as { __pwCache?: Cache; __pwFlush?: NodeJS.Timeout | null };

export function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const emptyMeta = (): Meta => ({ teams: [], matchIds: [] });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cache(): Cache {
  if (g.__pwCache) return g.__pwCache;
  const c: Cache = { meta: { ver: "", data: emptyMeta() }, matches: new Map() };
  if (!sharedStore()) {
    try {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
      if (parsed?.version === 1) {
        c.meta.data = { teams: parsed.teams, matchIds: parsed.matches.map((m) => m.id) };
        for (const m of parsed.matches) c.matches.set(m.id, { ver: "", data: m });
      }
    } catch {}
    if (process.env.VERCEL)
      console.warn("[store] No Redis configured on Vercel. State will NOT be shared between instances.");
  }
  return (g.__pwCache = c);
}

/** Snapshot of the whole tournament, as of the last sync. Read-only: mutate via withMeta/withMatch. */
export function db(): DB {
  const c = cache();
  const matches = c.meta.data.matchIds.map((id) => c.matches.get(id)?.data).filter((m): m is Match => !!m);
  return { version: 1, teams: c.meta.data.teams, matches };
}

/* ---------------- redis ---------------- */

async function redis(cmds: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  return out.map((o) => {
    if (o.error) throw new Error(`Redis: ${o.error}`);
    return o.result;
  });
}

const WRITE = "redis.call('SET', KEYS[1], ARGV[1]); redis.call('HSET', KEYS[2], ARGV[2], ARGV[3]); return 1";
const UNLOCK = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";

async function locked<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const key = K.lock(name);
  const token = uid();
  for (let i = 0; ; i++) {
    const [ok] = await redis([["SET", key, token, "NX", "PX", 8000]]);
    if (ok === "OK") break;
    if (i > 120) throw new Error("The server is busy. Try again.");
    await sleep(20 + Math.random() * 40);
  }
  try {
    return await fn();
  } finally {
    await redis([["EVAL", UNLOCK, 1, key, token]]).catch(() => {});
  }
}

async function syncRedis() {
  const c = cache();
  const [vers] = (await redis([["HGETALL", K.vers]])) as [string[] | null];
  const v = new Map<string, string>();
  for (let i = 0; i + 1 < (vers?.length ?? 0); i += 2) v.set(vers![i], vers![i + 1]);

  if ((v.get("meta") ?? "") !== c.meta.ver) {
    const [raw] = (await redis([["GET", K.meta]])) as [string | null];
    c.meta = { ver: v.get("meta") ?? "", data: raw ? (JSON.parse(raw) as Meta) : emptyMeta() };
  }
  const ids = c.meta.data.matchIds;
  const stale = ids.filter((id) => !c.matches.has(id) || c.matches.get(id)!.ver !== (v.get(id) ?? ""));
  if (stale.length) {
    const [docs] = (await redis([["MGET", ...stale.map(K.match)]])) as [(string | null)[]];
    stale.forEach((id, i) => {
      if (docs[i]) c.matches.set(id, { ver: v.get(id) ?? "", data: JSON.parse(docs[i]!) as Match });
      else c.matches.delete(id);
    });
  }
  const keep = new Set(ids);
  for (const id of c.matches.keys()) if (!keep.has(id)) c.matches.delete(id);
}

/**
 * Refresh the instance cache from the shared store. Called at the start of every
 * request, so a write on one instance is visible to the very next request anywhere.
 * Costs one small HGETALL, plus a fetch of only the docs that changed.
 */
export async function sync() {
  if (sharedStore()) await syncRedis();
}

/* ---------------- local file ---------------- */

function flushFile() {
  if (g.__pwFlush) return;
  g.__pwFlush = setTimeout(() => {
    g.__pwFlush = null;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      const tmp = FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(db()));
      fs.renameSync(tmp, FILE);
    } catch (e) {
      console.error("[store] failed to persist", e);
    }
  }, 250);
}

/* ---------------- mutations ---------------- */

/**
 * Run `fn` against a fresh copy of one doc under a lock and save it if it changed.
 * `fn` must be synchronous; do slow work (model calls) outside.
 */
async function withDoc<D, T>(
  lockName: string,
  docKey: string,
  field: string,
  fallback: () => D | undefined,
  apply: (d: D | undefined) => T,
  store: (d: D, ver: string) => void,
): Promise<T> {
  if (!sharedStore()) {
    const out = apply(fallback());
    flushFile();
    return out;
  }
  return locked(lockName, async () => {
    const [raw, ver] = (await redis([["GET", docKey], ["HGET", K.vers, field]])) as [string | null, string | null];
    const doc = raw ? (JSON.parse(raw) as D) : undefined;
    const out = apply(doc);
    if (doc !== undefined) {
      const next = JSON.stringify(doc);
      if (next !== raw) {
        const v = uid();
        await redis([["EVAL", WRITE, 2, docKey, K.vers, next, field, v]]);
        store(doc, v);
      } else store(doc, ver ?? "");
    }
    return out;
  });
}

export async function withMeta<T>(fn: (meta: Meta) => T): Promise<T> {
  const c = cache();
  if (sharedStore()) {
    // Create the meta doc on first use so withDoc always has one to edit.
    await redis([["SET", K.meta, JSON.stringify(emptyMeta()), "NX"]]);
  }
  return withDoc<Meta, T>(
    "meta",
    K.meta,
    "meta",
    () => c.meta.data,
    (m) => fn(m!),
    (m, ver) => (c.meta = { ver, data: m }),
  );
}

export async function withMatch<T>(id: string, fn: (m: Match | undefined) => T): Promise<T> {
  const c = cache();
  return withDoc<Match, T>(
    `m:${id}`,
    K.match(id),
    id,
    () => c.matches.get(id)?.data,
    fn,
    (m, ver) => c.matches.set(id, { ver, data: m }),
  );
}

/** Store a brand-new match doc (not yet listed in meta). */
export async function putMatch(m: Match) {
  const c = cache();
  const v = uid();
  if (sharedStore()) await redis([["EVAL", WRITE, 2, K.match(m.id), K.vers, JSON.stringify(m), m.id, v]]);
  c.matches.set(m.id, { ver: v, data: m });
  if (!sharedStore()) flushFile();
}

/** Remove a match doc (after it has been unlisted from meta). */
export async function dropMatch(id: string) {
  cache().matches.delete(id);
  if (sharedStore()) await redis([["DEL", K.match(id)], ["HDEL", K.vers, id]]);
  else flushFile();
}
