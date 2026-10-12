import type { ChatTurn, Claim, MatchPhase, MatchSettings, ProbeResult, Role, ScoreLine } from "./types";

export type { ChatTurn, Claim, MatchPhase, MatchSettings, ProbeResult, Role, ScoreLine };

export interface MeterCell {
  level: number;
  /** Revealed only once a fragment is fully extracted. */
  value?: string;
  kind: "word" | "number";
  length: number;
}

export interface RoundReport {
  index: number;
  secret: string;
  defense: string;
  meter: MeterCell[];
  utility: { status: string; results: ProbeResult[] };
  incoming: ChatTurn[];
  claimsAgainst: Claim[];
}

export interface TeamView {
  serverNow: number;
  demo: boolean;
  team: { id: string; name: string; members: { attacker: string; defender: string } };
  role: Role;
  match: null | {
    id: string;
    label: string;
    phase: MatchPhase;
    settings: MatchSettings;
    round: number;
    endsAt: number | null;
    opponent: string;
    side: "a" | "b";
    scores: { me: ScoreLine & { rounds: ScoreLine[] }; them: ScoreLine };
    attack?: {
      used: number;
      max: number;
      claims: Claim[];
      claimsLeft: number;
      thread: number;
      turns: ChatTurn[];
      meter: MeterCell[];
    };
    defense?: {
      draft: string;
      locked: string | null;
      secret: string | null;
      meter: MeterCell[];
      reports: RoundReport[];
    };
  };
}

export interface ArenaMatch {
  id: string;
  label: string;
  phase: MatchPhase;
  round: number;
  totalRounds: number;
  endsAt: number | null;
  teams: {
    name: string;
    score: ScoreLine;
    /** Leak meter on this team's secret for the current round. */
    meter: MeterCell[];
    revealed?: string;
    attacks: number;
  }[];
}

export interface Standing extends ScoreLine {
  teamId: string;
  name: string;
  played: number;
  rank: number;
}

export interface ArenaView {
  serverNow: number;
  matches: ArenaMatch[];
  standings: Standing[];
  teams: number;
}
