import { DEFAULT_SETTINGS, GRACE_SECONDS } from "./config";
import { vaultReply, type ChatMessage } from "./gemini";
import { judgeLeak, runProbe } from "./judge";
import { detectLeaks, scoreClaim } from "./leak";
import { pickProbes } from "./probes";
import { vaultSystemPrompt } from "./prompts";
import { generateSecret, practiceSecret } from "./secrets";
import { db, save, uid } from "./store";
import type { ChatTurn, Match, MatchSettings, Round, Side, SideRound, Team } from "./types";

export class GameError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const otherSide = (s: Side): Side => (s === "a" ? "b" : "a");
const now = () => Date.now();

function log(m: Match, event: string) {
  m.log.push({ at: now(), event });
}

/* ---------------- lookups ---------------- */

export function team(id: string): Team {
  const t = db().teams.find((x) => x.id === id);
  if (!t) throw new GameError("Team not found", 404);
  return t;
}

export function match(id: string): Match {
  const m = db().matches.find((x) => x.id === id);
  if (!m) throw new GameError("Match not found", 404);
  return m;
}

export function sideOf(m: Match, teamId: string): Side | null {
  return m.teams.a === teamId ? "a" : m.teams.b === teamId ? "b" : null;
}

const PHASE_ORDER = { live: 0, break: 1, lobby: 2, done: 3 } as const;

/** The match a team should currently be looking at. */
export function currentMatchFor(teamId: string): Match | null {
  const mine = db().matches.filter((m) => sideOf(m, teamId));
  if (!mine.length) return null;
  const open = mine.filter((m) => m.phase !== "done");
  if (open.length)
    return open.sort((x, y) => PHASE_ORDER[x.phase] - PHASE_ORDER[y.phase] || x.createdAt - y.createdAt)[0];
  return mine.sort((x, y) => (y.finishedAt ?? 0) - (x.finishedAt ?? 0))[0];
}

export function currentRound(m: Match): Round | null {
  return m.rounds[m.rounds.length - 1] ?? null;
}

/* ---------------- clock ---------------- */

/** Closes any round whose timer has run out. Called on every read. */
export function tick() {
  const t = now();
  for (const m of db().matches) {
    if (m.phase !== "live") continue;
    const r = currentRound(m);
    if (r && t >= r.endsAt) closeRound(m, r.endsAt);
  }
}

function closeRound(m: Match, at = now()) {
  const r = currentRound(m);
  if (!r || m.phase !== "live") return;
  r.endedAt = at;
  if (m.rounds.length >= m.settings.rounds) {
    m.phase = "done";
    m.finishedAt = at;
    log(m, `Round ${r.index + 1} ended. Match complete.`);
  } else {
    m.phase = "break";
    log(m, `Round ${r.index + 1} ended.`);
  }
  save();
}

/* ---------------- admin actions ---------------- */

export function createTeam(input: { name: string; attacker?: string; defender?: string; ieee?: boolean }): Team {
  const name = input.name.trim().slice(0, 40);
  if (!name) throw new GameError("Team name is required");
  if (db().teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) throw new GameError("That team name is taken");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (db().teams.some((t) => t.code === code));
  const t: Team = {
    id: uid("t_"),
    name,
    code,
    members: { attacker: (input.attacker ?? "").trim().slice(0, 40), defender: (input.defender ?? "").trim().slice(0, 40) },
    ieee: !!input.ieee,
    createdAt: now(),
  };
  db().teams.push(t);
  save();
  return t;
}

export function deleteTeam(id: string) {
  const d = db();
  if (d.matches.some((m) => sideOf(m, id) && m.phase !== "lobby"))
    throw new GameError("This team has played or is playing a match. Delete those matches first.");
  d.matches = d.matches.filter((m) => !sideOf(m, id));
  d.teams = d.teams.filter((t) => t.id !== id);
  save();
}

export function createMatch(a: string, b: string, opts: { label?: string; settings?: Partial<MatchSettings> } = {}): Match {
  if (a === b) throw new GameError("A team can't play itself");
  team(a);
  team(b);
  const settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  settings.rounds = Math.min(5, Math.max(1, Math.round(settings.rounds)));
  settings.roundSeconds = Math.min(1800, Math.max(30, Math.round(settings.roundSeconds)));
  const n = db().matches.length + 1;
  const m: Match = {
    id: uid("m_"),
    label: opts.label?.trim() || `Match ${n}`,
    teams: { a, b },
    settings,
    phase: "lobby",
    rounds: [],
    drafts: { a: "", b: "" },
    createdAt: now(),
    log: [],
  };
  log(m, "Match created.");
  db().matches.push(m);
  save();
  return m;
}

/** Pair every team for `perTeam` matches, avoiding rematches where possible. */
export function generateSchedule(perTeam = 3) {
  const ids = db().teams.map((t) => t.id);
  if (ids.length < 2) throw new GameError("Add at least two teams first");
  const played = new Set(db().matches.map((m) => [m.teams.a, m.teams.b].sort().join("|")));
  const created: Match[] = [];
  for (let slot = 0; slot < perTeam; slot++) {
    const pool = [...ids].sort(() => Math.random() - 0.5);
    while (pool.length >= 2) {
      const a = pool.shift()!;
      let j = pool.findIndex((b) => !played.has([a, b].sort().join("|")));
      if (j < 0) j = 0;
      const b = pool.splice(j, 1)[0];
      played.add([a, b].sort().join("|"));
      created.push(createMatch(a, b, { label: `Slot ${slot + 1} · ${team(a).name} vs ${team(b).name}` }));
    }
  }
  return created;
}

export function deleteMatch(id: string) {
  const d = db();
  d.matches = d.matches.filter((m) => m.id !== id);
  save();
}

export function startRound(id: string) {
  tick();
  const m = match(id);
  if (m.phase === "live") throw new GameError("A round is already live");
  if (m.phase === "done") throw new GameError("This match is finished");
  for (const s of ["a", "b"] as Side[]) {
    const busy = db().matches.find((x) => x.id !== m.id && x.phase === "live" && sideOf(x, m.teams[s]));
    if (busy) throw new GameError(`${team(m.teams[s]).name} is live in another match`);
  }

  const used = m.rounds.flatMap((r) => [r.sides.a.secret, r.sides.b.secret]);
  const sa = generateSecret(used);
  const sb = generateSecret([...used, sa.secret]);
  const mkSide = (sec: { secret: string; fragments: string[] }, s: Side): SideRound => ({
    secret: sec.secret,
    fragments: sec.fragments,
    defense: m.drafts[s].slice(0, m.settings.maxDefenseChars),
    leaked: sec.fragments.map(() => 0),
    incoming: [],
    claimsAgainst: [],
    thread: 1,
    utility: { status: "pending", results: [] },
  });
  const t = now();
  const round: Round = {
    index: m.rounds.length,
    startedAt: t,
    endsAt: t + m.settings.roundSeconds * 1000,
    probes: pickProbes(m.settings.probesPerRound, m.rounds.flatMap((r) => r.probes)),
    sides: { a: mkSide(sa, "a"), b: mkSide(sb, "b") },
  };
  m.rounds.push(round);
  m.phase = "live";
  log(m, `Round ${round.index + 1} started. Defenses locked.`);
  save();
  for (const s of ["a", "b"] as Side[]) void runUtility(m.id, round.index, s);
  return m;
}

export function endRoundNow(id: string) {
  const m = match(id);
  if (m.phase !== "live") throw new GameError("No live round");
  closeRound(m);
}

export function extendRound(id: string, seconds: number) {
  tick();
  const m = match(id);
  const r = currentRound(m);
  if (m.phase !== "live" || !r) throw new GameError("No live round");
  r.endsAt += seconds * 1000;
  log(m, `Round ${r.index + 1} extended by ${seconds}s.`);
  save();
}

export async function runUtility(matchId: string, roundIdx: number, side: Side) {
  const m = match(matchId);
  const r = m.rounds[roundIdx];
  const sr = r.sides[side];
  sr.utility = { status: "running", results: [] };
  const system = vaultSystemPrompt({ teamName: team(m.teams[side]).name, secret: sr.secret, defense: sr.defense });
  const results = await Promise.all(r.probes.map((p) => runProbe(system, p)));
  sr.utility = { status: "done", results };
  save();
}

/* ---------------- team actions ---------------- */

function liveContext(teamId: string) {
  tick();
  const m = currentMatchFor(teamId);
  if (!m) throw new GameError("You have no match scheduled yet");
  const side = sideOf(m, teamId)!;
  return { m, side };
}

export function saveDraft(teamId: string, text: string) {
  const { m, side } = liveContext(teamId);
  if (m.phase === "done") throw new GameError("This match is finished");
  m.drafts[side] = text.slice(0, m.settings.maxDefenseChars);
  save();
  return m.drafts[side];
}

const inflight = ((globalThis as unknown as { __pwInflight?: Set<string> }).__pwInflight ??= new Set());

export function attackBudget(m: Match, targetSide: Side) {
  const r = currentRound(m);
  const used = r ? r.sides[targetSide].incoming.filter((t) => t.role === "attacker").length : 0;
  return { used, max: m.settings.maxMessages };
}

export async function sendAttack(teamId: string, message: string) {
  const { m, side } = liveContext(teamId);
  const r = currentRound(m);
  if (m.phase !== "live" || !r) throw new GameError("No live round right now");
  if (now() > r.endsAt + GRACE_SECONDS * 1000) throw new GameError("Time's up for this round");
  const text = message.trim();
  if (!text) throw new GameError("Write something first");
  if (text.length > m.settings.maxAttackChars)
    throw new GameError(`Keep it under ${m.settings.maxAttackChars} characters`);
  const target = otherSide(side);
  const { used, max } = attackBudget(m, target);
  if (used >= max) throw new GameError("You've used every message for this round");
  const key = `${m.id}:${r.index}:${side}`;
  if (inflight.has(key)) throw new GameError("Wait for the vault to answer");

  const sr = r.sides[target];
  inflight.add(key);
  try {
    const thread = sr.thread;
    const prior = sr.incoming.filter((t) => t.thread === thread);
    const attackTurn: ChatTurn = { id: uid("c_"), role: "attacker", text, at: now(), thread };
    sr.incoming.push(attackTurn);
    save();

    const history: ChatMessage[] = [...prior, attackTurn].map((t) => ({
      role: t.role === "attacker" ? "user" : "model",
      text: t.text,
    }));
    const system = vaultSystemPrompt({ teamName: team(m.teams[target]).name, secret: sr.secret, defense: sr.defense });
    let reply: string;
    try {
      reply = await vaultReply(system, history);
    } catch (e) {
      // Refund the message: platform errors must not burn an attacker's budget.
      sr.incoming = sr.incoming.filter((t) => t.id !== attackTurn.id);
      save();
      console.error("[attack] model error", e);
      throw new GameError("The model didn't respond. Your message was not counted, try again.", 502);
    }

    const leaks = detectLeaks(reply, sr.fragments);
    const vaultTurn: ChatTurn = { id: uid("c_"), role: "vault", text: reply, at: now(), thread, leaks, source: "detector" };
    sr.incoming.push(vaultTurn);
    bumpLeaks(sr, leaks);
    save();

    if (leaks.some((l) => l < 1)) {
      const context = [...prior.slice(-6), attackTurn].map((t) => ({ role: t.role, text: t.text }));
      void judgeLeak(sr.fragments, context, reply).then((judged) => {
        if (!judged) return;
        const merged = leaks.map((l, i) => Math.max(l, judged[i] ?? 0));
        if (merged.some((v, i) => v > leaks[i])) {
          vaultTurn.leaks = merged;
          vaultTurn.source = "judge";
          bumpLeaks(sr, merged);
          save();
        }
      });
    }
    return vaultTurn;
  } finally {
    inflight.delete(key);
  }
}

function bumpLeaks(sr: SideRound, leaks: number[]) {
  sr.leaked = sr.leaked.map((v, i) => Math.max(v, leaks[i] ?? 0));
}

export function newThread(teamId: string) {
  const { m, side } = liveContext(teamId);
  const r = currentRound(m);
  if (m.phase !== "live" || !r) throw new GameError("No live round right now");
  const sr = r.sides[otherSide(side)];
  if (sr.incoming.some((t) => t.thread === sr.thread)) sr.thread++;
  save();
}

export function submitClaim(teamId: string, guess: string) {
  const { m, side } = liveContext(teamId);
  const r = currentRound(m);
  if (m.phase !== "live" || !r) throw new GameError("No live round right now");
  if (now() > r.endsAt + GRACE_SECONDS * 1000) throw new GameError("Time's up for this round");
  const sr = r.sides[otherSide(side)];
  if (sr.claimsAgainst.length >= m.settings.maxClaims) throw new GameError("No claims left this round");
  const g = guess.trim().slice(0, 80);
  if (!g) throw new GameError("Enter your guess");
  const claim = { id: uid("k_"), guess: g, at: now(), hits: scoreClaim(g, sr.fragments) };
  sr.claimsAgainst.push(claim);
  log(m, `${team(teamId).name} claimed "${g}" (${claim.hits.filter(Boolean).length}/${sr.fragments.length}).`);
  save();
  return claim;
}

/* ---------------- defender sandbox ---------------- */

const sandboxUse = ((globalThis as unknown as { __pwSandbox?: Map<string, number[]> }).__pwSandbox ??= new Map());
export const SANDBOX_PER_10_MIN = 30;

export async function sandboxChat(teamId: string, defense: string, history: ChatMessage[], secret?: string) {
  const t = team(teamId);
  const window = now() - 10 * 60_000;
  const hits = (sandboxUse.get(teamId) ?? []).filter((x: number) => x > window);
  if (hits.length >= SANDBOX_PER_10_MIN) throw new GameError("Sandbox limit reached. Try again in a few minutes.", 429);
  hits.push(now());
  sandboxUse.set(teamId, hits);
  const practice = secret && /^[A-Z]+-[A-Z]+-\d{4}$/.test(secret) ? { secret, fragments: secret.split("-") } : practiceSecret();
  const system = vaultSystemPrompt({ teamName: t.name, secret: practice.secret, defense: defense.slice(0, DEFAULT_SETTINGS.maxDefenseChars) });
  const reply = await vaultReply(system, history.slice(-16).map((h) => ({ role: h.role, text: h.text.slice(0, 1200) })));
  return { reply, secret: practice.secret, leaks: detectLeaks(reply, practice.fragments) };
}
