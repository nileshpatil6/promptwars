"use client";

import { useState } from "react";
import { api, usePoll } from "@/components/client";
import { Brand, Clock, PhaseChip, Spinner } from "@/components/ui";
import type { AdminView } from "@/lib/views";
import type { Match, Side } from "@/lib/types";

type AdminMatch = AdminView["matches"][number];

export default function Admin() {
  const { data, error, refresh, skew } = usePoll<AdminView>("/api/admin/state", 2000);

  if (error?.status === 401) return <AdminLogin onDone={refresh} />;
  if (!data)
    return (
      <div className="grid min-h-dvh place-items-center text-paper-2">
        <Spinner />
      </div>
    );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-ink/90 px-4 backdrop-blur-md md:px-6">
        <Brand compact />
        <div>
          <div className="text-[15px] font-semibold leading-tight">Organizer console</div>
          <div className="eyebrow !text-[9px]">Platform logs are the official record</div>
        </div>
        {data.demo && <span className="chip border-amber/40 text-amber">Demo mode · no API key</span>}
        <div className="ml-auto flex items-center gap-2">
          <a href="/arena" target="_blank" className="btn btn-sm">
            Live board ↗
          </a>
          <a href="/api/admin/export" className="btn btn-sm">
            Export log
          </a>
          <button
            className="btn btn-sm"
            onClick={async () => {
              await api("/api/auth/logout", { body: {} });
              void refresh();
            }}
          >
            Exit
          </button>
        </div>
      </header>

      <div className="grid xl:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="space-y-px self-start border-line bg-line xl:border-r">
          <TeamForm onDone={refresh} />
          <TeamList data={data} onDone={refresh} />
        </aside>
        <main className="min-w-0">
          <MatchForm data={data} onDone={refresh} />
          <div className="divide-y divide-line">
            {data.matches.length === 0 && <p className="p-6 font-mono text-[12px] text-mute">No matches yet. Create one above or generate a schedule.</p>}
            {[...data.matches]
              .sort((x, y) => order(x.phase) - order(y.phase) || x.createdAt - y.createdAt)
              .map((m) => (
                <MatchRow key={m.id} m={m} data={data} skew={skew} onDone={refresh} />
              ))}
          </div>
          <Standings data={data} />
        </main>
      </div>
    </div>
  );
}

const order = (p: Match["phase"]) => ({ live: 0, break: 1, lobby: 2, done: 3 })[p];

function useAction(onDone: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError("");
    try {
      await fn();
      await onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, run };
}

function AdminLogin({ onDone }: { onDone: () => Promise<void> }) {
  const [pw, setPw] = useState("");
  const { busy, error, run } = useAction(onDone);
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run("login", () => api("/api/auth/admin", { body: { password: pw } }));
        }}
        className="panel ticks w-full max-w-sm p-8"
      >
        <Brand />
        <h1 className="display mt-10 text-5xl">Organizers only</h1>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="field mt-6" autoFocus />
        {error && <div className="mt-3 font-mono text-[12px] text-red">{error}</div>}
        <button className="btn btn-solid mt-5 w-full" disabled={!pw || !!busy}>
          {busy ? <Spinner /> : "Unlock console"}
        </button>
      </form>
    </main>
  );
}

function TeamForm({ onDone }: { onDone: () => Promise<void> }) {
  const [f, setF] = useState({ name: "", attacker: "", defender: "", ieee: false });
  const { busy, error, run } = useAction(onDone);
  return (
    <form
      className="bg-ink p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void run("team", async () => {
          await api("/api/admin/teams", { body: f });
          setF({ name: "", attacker: "", defender: "", ieee: false });
        });
      }}
    >
      <div className="eyebrow">Register team</div>
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Team name" className="field mt-3" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input value={f.attacker} onChange={(e) => setF({ ...f, attacker: e.target.value })} placeholder="Attacker name" className="field !text-[13px]" />
        <input value={f.defender} onChange={(e) => setF({ ...f, defender: e.target.value })} placeholder="Defender name" className="field !text-[13px]" />
      </div>
      <label className="mt-3 flex items-center gap-2 font-mono text-[12px] text-paper-2">
        <input type="checkbox" checked={f.ieee} onChange={(e) => setF({ ...f, ieee: e.target.checked })} className="accent-red" /> IEEE members (₹79)
      </label>
      {error && <div className="mt-2 font-mono text-[11px] text-red">{error}</div>}
      <button className="btn btn-solid btn-sm mt-4 w-full" disabled={!f.name.trim() || !!busy}>
        {busy ? <Spinner /> : "Add team & issue code"}
      </button>
    </form>
  );
}

function TeamList({ data, onDone }: { data: AdminView; onDone: () => Promise<void> }) {
  const { busy, error, run } = useAction(onDone);
  return (
    <div className="bg-ink p-5">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Teams</span>
        <span className="font-mono text-[11px] text-mute">{data.teams.length}</span>
      </div>
      {error && <div className="mt-2 font-mono text-[11px] text-red">{error}</div>}
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {data.teams.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px]">
                {t.name}
                {t.ieee && <span className="ml-2 font-mono text-[9px] text-blue">IEEE</span>}
              </div>
              <div className="truncate font-mono text-[10px] text-mute">
                {[t.members.attacker && `A: ${t.members.attacker}`, t.members.defender && `D: ${t.members.defender}`].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(t.code)}
              title="Copy code"
              className="border border-line-2 px-2 py-1 font-mono text-[13px] tracking-[0.2em] text-paper hover:border-paper"
            >
              {t.code}
            </button>
            <button
              onClick={() => confirm(`Delete ${t.name}?`) && run(t.id, () => api("/api/admin/teams", { method: "DELETE", body: { id: t.id } }))}
              disabled={busy === t.id}
              className="font-mono text-[14px] text-faint hover:text-red"
              aria-label={`Delete ${t.name}`}
            >
              ×
            </button>
          </li>
        ))}
        {!data.teams.length && <li className="py-3 font-mono text-[12px] text-mute">None yet.</li>}
      </ul>
    </div>
  );
}

function MatchForm({ data, onDone }: { data: AdminView; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ a: "", b: "", label: "", rounds: 3, minutes: 5 });
  const { busy, error, run } = useAction(onDone);
  return (
    <div className="border-b border-line p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-5xl">Matches</h1>
        <button
          className="btn btn-sm"
          disabled={data.teams.length < 2 || !!busy}
          onClick={() =>
            confirm("Pair every team for 3 matches, avoiding rematches?") && run("schedule", () => api("/api/admin/schedule", { body: { perTeam: 3 } }))
          }
        >
          {busy === "schedule" ? <Spinner /> : "Generate 3-match schedule"}
        </button>
      </div>
      <form
        className="mt-5 grid gap-2 md:grid-cols-[1fr_1fr_1fr_90px_90px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void run("match", () =>
            api("/api/admin/matches", {
              body: { a: f.a, b: f.b, label: f.label, settings: { rounds: f.rounds, roundSeconds: Math.round(f.minutes * 60) } },
            }),
          );
        }}
      >
        {(["a", "b"] as const).map((k) => (
          <select key={k} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="field !text-[13px]">
            <option value="">{k === "a" ? "Team A (red)" : "Team B (blue)"}</option>
            {data.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ))}
        <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Label (optional)" className="field !text-[13px]" />
        <label className="relative">
          <input type="number" min={1} max={5} value={f.rounds} onChange={(e) => setF({ ...f, rounds: Number(e.target.value) })} className="field !pr-10 !text-[13px]" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-mute">RND</span>
        </label>
        <label className="relative">
          <input type="number" min={0.5} max={30} step={0.5} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} className="field !pr-10 !text-[13px]" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-mute">MIN</span>
        </label>
        <button className="btn btn-solid" disabled={!f.a || !f.b || f.a === f.b || !!busy}>
          Create
        </button>
      </form>
      <p className="mt-2 font-mono text-[10px] text-faint">Sudden death: 1 round, 5 min.</p>
      {error && <div className="mt-2 font-mono text-[12px] text-red">{error}</div>}
    </div>
  );
}

function MatchRow({ m, data, skew, onDone }: { m: AdminMatch; data: AdminView; skew: number; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useAction(onDone);
  const name = (id: string) => data.teams.find((t) => t.id === id)?.name ?? "?";
  const r = m.rounds[m.rounds.length - 1];
  const act = (action: string, extra: object = {}) => run(action, () => api("/api/admin/matches", { method: "PATCH", body: { id: m.id, action, ...extra } }));
  const canStart = m.phase === "lobby" || m.phase === "break";

  return (
    <div className="px-5 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-3">
            <PhaseChip phase={m.phase} />
            <span className="font-mono text-[11px] text-mute">
              R{m.rounds.length}/{m.settings.rounds} · {Math.round(m.settings.roundSeconds / 60 * 10) / 10} min
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-3 text-[16px]">
            <span className="text-red">{name(m.teams.a)}</span>
            <span className="font-mono text-[14px] tabular-nums">{m.scores.a.total.toFixed(1)}</span>
            <span className="text-faint">vs</span>
            <span className="font-mono text-[14px] tabular-nums">{m.scores.b.total.toFixed(1)}</span>
            <span className="text-blue">{name(m.teams.b)}</span>
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-faint">{m.label}</div>
        </div>
        <Clock endsAt={m.phase === "live" && r ? r.endsAt : null} skew={skew} idle="" className="text-2xl" />
        <div className="flex flex-wrap gap-2">
          {canStart && (
            <button className="btn btn-red btn-sm" disabled={!!busy} onClick={() => act("start")}>
              {busy === "start" ? <Spinner /> : `Start round ${m.rounds.length + 1}`}
            </button>
          )}
          {m.phase === "live" && (
            <>
              <button className="btn btn-sm" disabled={!!busy} onClick={() => act("extend", { seconds: 60 })}>
                +1 min
              </button>
              <button className="btn btn-sm" disabled={!!busy} onClick={() => confirm("End this round now?") && act("end")}>
                End round
              </button>
            </>
          )}
          <button className="btn btn-sm" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Inspect"}
          </button>
          <button className="btn btn-sm !text-faint hover:!text-red" disabled={!!busy} onClick={() => confirm("Delete this match and all its logs?") && act("delete")}>
            Delete
          </button>
        </div>
      </div>
      {error && <div className="mt-2 font-mono text-[12px] text-red">{error}</div>}
      {open && <MatchDetail m={m} name={name} onRegrade={() => act("regrade")} regrading={busy === "regrade"} />}
    </div>
  );
}

function MatchDetail({ m, name, onRegrade, regrading }: { m: AdminMatch; name: (id: string) => string; onRegrade: () => void; regrading: boolean }) {
  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-px border border-line bg-line md:grid-cols-2">
        {(["a", "b"] as Side[]).map((s) => (
          <div key={s} className="bg-ink p-4">
            <div className={`font-mono text-[11px] uppercase tracking-[0.14em] ${s === "a" ? "text-red" : "text-blue"}`}>{name(m.teams[s])}</div>
            <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-[12px]">
              {(["attack", "defense", "utility", "total"] as const).map((k) => (
                <div key={k}>
                  <div className="text-[9px] uppercase tracking-[0.14em] text-mute">{k}</div>
                  <div className="tabular-nums">{m.scores[s][k].toFixed(1)}</div>
                </div>
              ))}
            </div>
            <div className="eyebrow mt-4 !text-[9px]">Current draft</div>
            <pre className="scroll-thin mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-paper-2">{m.drafts[s] || "(empty)"}</pre>
          </div>
        ))}
      </div>

      {m.rounds.map((r) => (
        <div key={r.index} className="border border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-2">
            <span className="font-mono text-[12px]">Round {r.index + 1}</span>
            <span className="font-mono text-[10px] text-mute">
              {new Date(r.startedAt).toLocaleTimeString()} → {r.endedAt ? new Date(r.endedAt).toLocaleTimeString() : "live"}
            </span>
          </div>
          <div className="grid divide-line md:grid-cols-2 md:divide-x">
            {(["a", "b"] as Side[]).map((s) => {
              const sr = r.sides[s];
              return (
                <div key={s} className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[11px] ${s === "a" ? "text-red" : "text-blue"}`}>{name(m.teams[s])}&apos;s vault</span>
                    <span className="font-mono text-[12px] tracking-[0.12em]">{sr.secret}</span>
                  </div>
                  <div className="flex gap-1">
                    {sr.fragments.map((f, i) => (
                      <div key={f} className="flex-1 border border-line px-2 py-1 font-mono text-[10px]">
                        {f} <span className={sr.leaked[i] > 0 ? "text-red" : "text-mute"}>{Math.round(sr.leaked[i] * 100)}%</span>
                      </div>
                    ))}
                  </div>
                  <details>
                    <summary className="cursor-pointer font-mono text-[11px] text-paper-2">Locked defense ({sr.defense.length} chars)</summary>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-mute">{sr.defense || "(empty)"}</pre>
                  </details>
                  <details>
                    <summary className="cursor-pointer font-mono text-[11px] text-paper-2">
                      Utility · {sr.utility.status}
                      {sr.utility.results.length ? ` · ${sr.utility.results.map((x) => x.score).join(" / ")}` : ""}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {sr.utility.results.map((p, i) => (
                        <div key={i} className="font-mono text-[11px]">
                          <div className="text-paper">{p.probe}</div>
                          <div className="text-mute">→ {p.answer.slice(0, 280)}</div>
                          <div className="text-amber">{p.score} · {p.note}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                  <details open={sr.incoming.length > 0 && sr.incoming.length < 8}>
                    <summary className="cursor-pointer font-mono text-[11px] text-paper-2">
                      Transcript · {sr.incoming.filter((t) => t.role === "attacker").length} attacks · {sr.claimsAgainst.length} claims
                    </summary>
                    <div className="scroll-thin mt-2 max-h-80 space-y-1.5 overflow-y-auto">
                      {sr.incoming.map((t) => (
                        <div key={t.id} className={`font-mono text-[11px] leading-relaxed ${t.role === "attacker" ? "text-red" : "text-paper-2"}`}>
                          <span className="text-faint">{new Date(t.at).toLocaleTimeString()} T{t.thread} </span>
                          {t.text}
                          {t.leaks?.some((l) => l > 0) && <span className="ml-1 text-amber">[{t.leaks.join(",")} · {t.source}]</span>}
                        </div>
                      ))}
                      {sr.claimsAgainst.map((c) => (
                        <div key={c.id} className="font-mono text-[11px] text-amber">
                          CLAIM {c.guess} → {c.hits.map((h) => (h ? "✓" : "✗")).join("")}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scroll-thin max-h-32 flex-1 overflow-y-auto font-mono text-[10px] text-mute">
          {m.log.map((l, i) => (
            <div key={i}>
              {new Date(l.at).toLocaleTimeString()} · {l.event}
            </div>
          ))}
        </div>
        {!!m.rounds.length && (
          <button className="btn btn-sm" onClick={onRegrade} disabled={regrading}>
            {regrading ? <Spinner /> : "Re-run utility grading"}
          </button>
        )}
      </div>
    </div>
  );
}

function Standings({ data }: { data: AdminView }) {
  return (
    <div className="border-t border-line p-5 md:p-6">
      <h2 className="display text-4xl">Standings</h2>
      <table className="mt-4 w-full font-mono text-[12px]">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.14em] text-mute">
            <th className="py-2">#</th>
            <th>Team</th>
            <th className="text-right">Played</th>
            <th className="text-right">Attack</th>
            <th className="text-right">Defense</th>
            <th className="text-right">Utility</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.standings.map((s) => (
            <tr key={s.teamId} className="border-b border-line">
              <td className="py-2">{s.rank}</td>
              <td className="font-sans text-[14px]">{s.name}</td>
              <td className="text-right">{s.played}</td>
              <td className="text-right text-red">{s.attack.toFixed(1)}</td>
              <td className="text-right text-blue">{s.defense.toFixed(1)}</td>
              <td className="text-right">{s.utility.toFixed(1)}</td>
              <td className="text-right text-[14px] text-paper">{s.total.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
