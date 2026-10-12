"use client";

import { useNow, usePoll } from "@/components/client";
import { Brand, Clock, Meter, PhaseChip, Spinner } from "@/components/ui";
import type { ArenaMatch, ArenaView } from "@/lib/view-types";

export default function Arena() {
  const { data, skew } = usePoll<ArenaView>("/api/arena", 2000);

  if (!data)
    return (
      <div className="grid min-h-dvh place-items-center text-paper-2">
        <Spinner />
      </div>
    );

  const live = data.matches.filter((m) => m.phase === "live" || m.phase === "break");
  const rest = data.matches.filter((m) => m.phase === "lobby" || m.phase === "done").slice(0, 6);

  return (
    <main className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Brand />
        <div className="flex items-center gap-6 font-mono text-[12px] text-paper-2">
          <span>{data.teams} teams</span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 animate-blink rounded-full bg-red" /> {data.matches.filter((m) => m.phase === "live").length} live
          </span>
          <LocalTime skew={skew} />
        </div>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_480px]">
        <section className="border-line p-6 xl:border-r">
          <div className="flex items-end justify-between">
            <h1 className="display text-[clamp(48px,6vw,96px)]">
              On the <span className="text-red">wire</span>
            </h1>
            <span className="eyebrow pb-2">Secrets stay redacted until each round ends</span>
          </div>

          {!live.length ? (
            <div className="mt-8 panel ticks grid h-72 place-items-center">
              <div className="text-center">
                <div className="display text-5xl text-paper-2">No match in play</div>
                <p className="mt-3 font-mono text-[12px] text-mute">Next round starts on the organizers&apos; signal.</p>
              </div>
            </div>
          ) : (
            <div className="mt-8 grid gap-4 2xl:grid-cols-2">
              {live.map((m) => (
                <LiveCard key={m.id} m={m} skew={skew} />
              ))}
            </div>
          )}

          {!!rest.length && (
            <>
              <div className="eyebrow mt-12">Up next &amp; final</div>
              <div className="mt-3 grid gap-px border border-line bg-line md:grid-cols-2 2xl:grid-cols-3">
                {rest.map((m) => (
                  <div key={m.id} className="bg-ink p-4">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-mono text-[11px] text-mute">{m.label}</span>
                      <PhaseChip phase={m.phase} />
                    </div>
                    {m.teams.map((t, i) => (
                      <div key={i} className="mt-2 flex items-center justify-between">
                        <span className={`truncate text-[15px] ${i === 0 ? "text-paper" : "text-paper-2"}`}>{t.name}</span>
                        <span className="font-mono text-[14px] tabular-nums">{m.phase === "done" ? t.score.total.toFixed(1) : "—"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="p-6">
          <h2 className="display text-5xl">Leaderboard</h2>
          <div className="mt-6 border-t border-line">
            <div className="grid grid-cols-[40px_1fr_repeat(3,48px)_64px] gap-2 border-b border-line py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
              <span>#</span>
              <span>Team</span>
              <span className="text-right">Atk</span>
              <span className="text-right">Def</span>
              <span className="text-right">Utl</span>
              <span className="text-right">Total</span>
            </div>
            {data.standings.map((s) => (
              <div
                key={s.teamId}
                className={`grid grid-cols-[40px_1fr_repeat(3,48px)_64px] items-center gap-2 border-b border-line py-3 ${s.rank <= 3 && s.total > 0 ? "" : "text-paper-2"}`}
              >
                <span className={`display text-2xl ${s.rank === 1 && s.total > 0 ? "text-red" : ""}`}>{String(s.rank).padStart(2, "0")}</span>
                <span className="truncate text-[15px]">
                  {s.name}
                  <span className="ml-2 font-mono text-[10px] text-faint">{s.played}P</span>
                </span>
                <span className="text-right font-mono text-[13px] tabular-nums text-red/90">{s.attack.toFixed(1)}</span>
                <span className="text-right font-mono text-[13px] tabular-nums text-blue">{s.defense.toFixed(1)}</span>
                <span className="text-right font-mono text-[13px] tabular-nums">{s.utility.toFixed(1)}</span>
                <span className="text-right font-mono text-[17px] font-semibold tabular-nums text-paper">{s.total.toFixed(1)}</span>
              </div>
            ))}
            {!data.standings.length && <p className="py-6 font-mono text-[12px] text-mute">Teams appear here once registered.</p>}
          </div>
          <p className="mt-4 font-mono text-[10px] leading-relaxed text-faint">
            Tie-breakers: total → attack → defense → utility → 5-min sudden death.
          </p>
        </aside>
      </div>
    </main>
  );
}

function LiveCard({ m, skew }: { m: ArenaMatch; skew: number }) {
  return (
    <div className="panel ticks">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-3">
          <PhaseChip phase={m.phase} />
          <span className="font-mono text-[12px] text-paper-2">
            Round {m.round}/{m.totalRounds}
          </span>
        </div>
        <Clock endsAt={m.endsAt} skew={skew} idle="BREAK" className="text-4xl font-semibold" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-line">
        {m.teams.map((t, i) => (
          <div key={i} className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className={`display truncate text-3xl ${i === 0 ? "text-red" : "text-blue"}`}>{t.name}</span>
              <span className="font-mono text-2xl tabular-nums">{t.score.total.toFixed(1)}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-mute">{t.attacks} attacks received this round</div>
            <div className="eyebrow mb-2 mt-4 !text-[9px]">Secret exposure</div>
            <div>
              <Meter cells={t.meter} size="md" showValues={!!t.revealed} />
            </div>
            {t.revealed && <div className="mt-2 font-mono text-[12px] tracking-[0.16em] text-paper-2">{t.revealed}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function LocalTime({ skew }: { skew: number }) {
  const now = useNow(skew, 1000);
  return <span className="tabular-nums">{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}
