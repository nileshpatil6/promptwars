"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AttackConsole } from "@/components/attack-console";
import { api, usePoll } from "@/components/client";
import { DefenseConsole } from "@/components/defense-console";
import { Brand, Clock, Empty, PhaseChip, Spinner } from "@/components/ui";
import type { TeamView } from "@/lib/view-types";

export default function Play() {
  const router = useRouter();
  const { data, error, refresh, skew } = usePoll<TeamView>("/api/team/state", 1500);

  useEffect(() => {
    if (error?.status === 401) router.replace("/login");
  }, [error, router]);

  async function logout() {
    await api("/api/auth/logout", { body: {} }).catch(() => {});
    router.replace("/login");
  }

  if (!data)
    return (
      <div className="grid min-h-dvh place-items-center text-paper-2">
        <Spinner />
      </div>
    );

  const m = data.match;
  const tone = data.role === "attacker" ? "red" : "blue";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
          <Brand compact />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">{data.team.name}</div>
            <div className={`font-mono text-[10px] uppercase tracking-[0.16em] ${tone === "red" ? "text-red" : "text-blue"}`}>
              {data.role} console
            </div>
          </div>

          {m && (
            <div className="mx-auto hidden items-center gap-5 md:flex">
              <span className="eyebrow">{m.label}</span>
              <PhaseChip phase={m.phase} />
              <span className="font-mono text-[12px] text-paper-2">
                Round {Math.max(1, m.round)}/{m.settings.rounds}
              </span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-5">
            {m && (
              <>
                <Clock endsAt={m.endsAt} skew={skew} idle={m.phase === "done" ? "FINAL" : m.phase === "break" ? "BREAK" : "PREP"} className="text-3xl font-semibold" />
                <div className="hidden text-right lg:block">
                  <div className="font-mono text-[15px] tabular-nums">
                    <span className="text-paper">{m.scores.me.total.toFixed(1)}</span>
                    <span className="mx-2 text-faint">:</span>
                    <span className="text-paper-2">{m.scores.them.total.toFixed(1)}</span>
                  </div>
                  <div className="eyebrow !text-[9px]">vs {m.opponent}</div>
                </div>
              </>
            )}
            <button onClick={logout} className="btn btn-sm">
              Exit
            </button>
          </div>
        </div>
        {m && <ScoreStrip m={m} />}
      </header>

      {data.demo && (
        <div className="border-b border-amber/30 bg-amber/10 px-4 py-2 text-center font-mono text-[11px] text-amber">
          Demo mode: no GEMINI_API_KEY configured, so replies come from an offline mock.
        </div>
      )}

      <main className="flex-1">
        {!m ? (
          <div className="px-4 py-24">
            <Empty
              title="Stand by."
              body={`${data.team.name} hasn't been paired yet. Your match will appear here automatically once the organizers schedule it.`}
            />
          </div>
        ) : data.role === "attacker" ? (
          <AttackConsole view={data} refresh={refresh} />
        ) : (
          <DefenseConsole view={data} refresh={refresh} />
        )}
      </main>
    </div>
  );
}

function ScoreStrip({ m }: { m: NonNullable<TeamView["match"]> }) {
  const s = m.scores.me;
  return (
    <div className="flex items-center gap-6 overflow-x-auto border-t border-line px-4 py-2 font-mono text-[11px] md:px-6">
      <span className="text-mute md:hidden">
        R{Math.max(1, m.round)}/{m.settings.rounds} · vs {m.opponent}
      </span>
      <span className="flex items-center gap-2 text-paper-2">
        <span className="size-1.5 bg-red" /> ATK <b className="font-semibold text-paper tabular-nums">{s.attack.toFixed(1)}</b>
        <span className="text-faint">/40</span>
      </span>
      <span className="flex items-center gap-2 text-paper-2">
        <span className="size-1.5 bg-blue" /> DEF <b className="font-semibold text-paper tabular-nums">{s.defense.toFixed(1)}</b>
        <span className="text-faint">/40</span>
      </span>
      <span className="flex items-center gap-2 text-paper-2">
        <span className="size-1.5 bg-paper" /> UTL <b className="font-semibold text-paper tabular-nums">{s.utility.toFixed(1)}</b>
        <span className="text-faint">/20</span>
      </span>
      <span className="ml-auto hidden text-mute sm:inline">Scores update live from the platform log</span>
    </div>
  );
}
