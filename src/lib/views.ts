import { demoMode } from "./config";
import { attackBudget, currentMatchFor, currentRound, otherSide, sideOf, team, tick } from "./game";
import { effectiveLeak, leaderboard, matchScores } from "./scoring";
import { db } from "./store";
import type { Match, Role, Side } from "./types";
import type { ArenaView, MeterCell, RoundReport, TeamView } from "./view-types";

function meter(m: Match, roundIdx: number, side: Side, reveal: boolean): MeterCell[] {
  const sr = m.rounds[roundIdx].sides[side];
  const levels = effectiveLeak(m, roundIdx, side);
  return sr.fragments.map((f, i) => ({
    level: levels[i],
    value: reveal || levels[i] >= 1 ? f : undefined,
    kind: /^\d+$/.test(f) ? "number" : "word",
    length: f.length,
  }));
}

export function teamView(teamId: string, role: Role): TeamView {
  tick();
  const t = team(teamId);
  const base: TeamView = {
    serverNow: Date.now(),
    demo: demoMode(),
    team: { id: t.id, name: t.name, members: t.members },
    role,
    match: null,
  };
  const m = currentMatchFor(teamId);
  if (!m) return base;
  const side = sideOf(m, teamId)!;
  const them = otherSide(side);
  const r = currentRound(m);
  const scores = matchScores(m);
  const view: NonNullable<TeamView["match"]> = {
    id: m.id,
    label: m.label,
    phase: m.phase,
    settings: m.settings,
    round: m.rounds.length,
    endsAt: m.phase === "live" && r ? r.endsAt : null,
    opponent: team(m.teams[them]).name,
    side,
    scores: { me: scores[side], them: scores[them] },
  };

  if (role === "attacker") {
    const sr = r?.sides[them];
    const { used, max } = attackBudget(m, them);
    view.attack = {
      used,
      max,
      claims: sr?.claimsAgainst ?? [],
      claimsLeft: m.settings.maxClaims - (sr?.claimsAgainst.length ?? 0),
      thread: sr?.thread ?? 1,
      turns: sr?.incoming ?? [],
      meter: r ? meter(m, r.index, them, m.phase !== "live") : [],
    };
  } else {
    const reports: RoundReport[] = m.rounds
      // Incoming attacks become visible to the defender only after the round.
      .filter((round) => !(m.phase === "live" && round.index === r?.index))
      .map((round) => {
        const sr = round.sides[side];
        return {
          index: round.index,
          secret: sr.secret,
          defense: sr.defense,
          meter: meter(m, round.index, side, true),
          utility: sr.utility,
          incoming: sr.incoming,
          claimsAgainst: sr.claimsAgainst,
        };
      })
      .reverse();
    view.defense = {
      draft: m.drafts[side],
      locked: m.phase === "live" && r ? r.sides[side].defense : null,
      secret: m.phase === "live" && r ? r.sides[side].secret : null,
      meter: m.phase === "live" && r ? meter(m, r.index, side, true) : [],
      reports,
    };
  }
  base.match = view;
  return base;
}

export function arenaView(): ArenaView {
  tick();
  const d = db();
  const order = { live: 0, break: 1, lobby: 2, done: 3 } as const;
  const matches = [...d.matches]
    .sort((x, y) => order[x.phase] - order[y.phase] || y.createdAt - x.createdAt)
    .slice(0, 12)
    .map((m) => {
      const r = currentRound(m);
      const s = matchScores(m);
      return {
        id: m.id,
        label: m.label,
        phase: m.phase,
        round: m.rounds.length,
        totalRounds: m.settings.rounds,
        endsAt: m.phase === "live" && r ? r.endsAt : null,
        teams: (["a", "b"] as Side[]).map((side) => ({
          name: team(m.teams[side]).name,
          score: s[side],
          meter: r ? meter(m, r.index, side, false).map((c) => ({ ...c, value: m.phase === "live" ? undefined : c.value })) : [],
          revealed: r && m.phase !== "live" ? r.sides[side].secret : undefined,
          attacks: r ? r.sides[otherSide(side)].incoming.filter((x) => x.role === "attacker").length : 0,
        })),
      };
    });
  return { serverNow: Date.now(), matches, standings: leaderboard(d), teams: d.teams.length };
}

export function adminView() {
  tick();
  const d = db();
  return {
    serverNow: Date.now(),
    demo: demoMode(),
    teams: d.teams,
    matches: d.matches.map((m) => ({ ...m, scores: matchScores(m) })),
    standings: leaderboard(d),
  };
}
export type AdminView = ReturnType<typeof adminView>;
