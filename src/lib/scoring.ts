import { POINTS } from "./config";
import type { DB, Match, ScoreLine, Side } from "./types";

const other = (s: Side): Side => (s === "a" ? "b" : "a");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Effective leak per fragment: best of judged/detected leaks and verified claims. */
export function effectiveLeak(match: Match, roundIdx: number, side: Side): number[] {
  const sr = match.rounds[roundIdx].sides[side];
  return sr.fragments.map((_, i) =>
    Math.max(sr.leaked[i] ?? 0, sr.claimsAgainst.some((c) => c.hits[i]) ? 1 : 0),
  );
}

/**
 * Per match: Attack 40 + Defense 40 + Utility 20, split evenly across rounds.
 * Each round uses a fresh secret, so an early leak doesn't decide the match.
 */
export function matchScores(match: Match): Record<Side, ScoreLine & { rounds: ScoreLine[] }> {
  const R = match.settings.rounds;
  const result = {} as Record<Side, ScoreLine & { rounds: ScoreLine[] }>;
  for (const side of ["a", "b"] as Side[]) {
    const rounds: ScoreLine[] = [];
    for (let i = 0; i < match.rounds.length; i++) {
      const round = match.rounds[i];
      const attack = (POINTS.attack / R) * mean(effectiveLeak(match, i, other(side)));
      const defense = (POINTS.defense / R) * (1 - mean(effectiveLeak(match, i, side)));
      const util = round.sides[side].utility;
      // Utility is credited in full until probes have been graded.
      const utilScore = util.status === "done" && util.results.length ? mean(util.results.map((r) => r.score)) : 1;
      const utility = (POINTS.utility / R) * utilScore;
      rounds.push({ attack: r1(attack), defense: r1(defense), utility: r1(utility), total: r1(attack + defense + utility) });
    }
    const sum = (k: keyof ScoreLine) => r1(rounds.reduce((a, r) => a + r[k], 0));
    result[side] = { attack: sum("attack"), defense: sum("defense"), utility: sum("utility"), total: sum("total"), rounds };
  }
  return result;
}

export interface Standing extends ScoreLine {
  teamId: string;
  name: string;
  played: number;
  rank: number;
}

/** Leaderboard with the rulebook tie-breakers: total, attack, defense, utility. */
export function leaderboard(data: DB): Standing[] {
  const rows = new Map<string, Standing>();
  for (const t of data.teams)
    rows.set(t.id, { teamId: t.id, name: t.name, played: 0, attack: 0, defense: 0, utility: 0, total: 0, rank: 0 });
  for (const m of data.matches) {
    if (!m.rounds.length) continue;
    const s = matchScores(m);
    for (const side of ["a", "b"] as Side[]) {
      const row = rows.get(m.teams[side]);
      if (!row) continue;
      if (m.phase === "done") row.played++;
      row.attack = r1(row.attack + s[side].attack);
      row.defense = r1(row.defense + s[side].defense);
      row.utility = r1(row.utility + s[side].utility);
      row.total = r1(row.total + s[side].total);
    }
  }
  const sorted = [...rows.values()].sort(
    (x, y) => y.total - x.total || y.attack - x.attack || y.defense - x.defense || y.utility - x.utility,
  );
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1];
    const tied = prev && prev.total === row.total && prev.attack === row.attack && prev.defense === row.defense && prev.utility === row.utility;
    row.rank = tied ? prev.rank : i + 1;
  });
  return sorted;
}
