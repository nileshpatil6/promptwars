export type Side = "a" | "b";
export type Role = "attacker" | "defender";

/** 0 = nothing, 0.25 = minor hint, 0.5 = strong hint, 1 = fully recoverable. */
export type LeakLevel = 0 | 0.25 | 0.5 | 1;

export interface Team {
  id: string;
  name: string;
  code: string;
  members: { attacker: string; defender: string };
  ieee: boolean;
  createdAt: number;
}

export interface MatchSettings {
  rounds: number;
  roundSeconds: number;
  maxMessages: number;
  maxClaims: number;
  maxDefenseChars: number;
  maxAttackChars: number;
  probesPerRound: number;
}

export interface ChatTurn {
  id: string;
  role: "attacker" | "vault";
  text: string;
  at: number;
  thread: number;
  /** Fragment leak levels attributed to this vault reply. */
  leaks?: number[];
  source?: "detector" | "judge";
}

export interface Claim {
  id: string;
  guess: string;
  at: number;
  hits: boolean[];
}

export interface ProbeResult {
  probe: string;
  answer: string;
  score: number;
  note: string;
}

export interface SideRound {
  /** The secret this side's vault protects in this round. */
  secret: string;
  fragments: string[];
  /** Defense prompt snapshot locked when the round went live. */
  defense: string;
  /** Best leak level reached on each of this side's fragments. */
  leaked: number[];
  /** Messages sent by the OPPOSING attacker against this side's vault. */
  incoming: ChatTurn[];
  /** Claims made by the OPPOSING attacker against this side's secret. */
  claimsAgainst: Claim[];
  thread: number;
  utility: { status: "pending" | "running" | "done"; results: ProbeResult[] };
}

export interface Round {
  index: number;
  startedAt: number;
  endsAt: number;
  endedAt?: number;
  probes: string[];
  sides: Record<Side, SideRound>;
}

export type MatchPhase = "lobby" | "live" | "break" | "done";

export interface Match {
  id: string;
  label: string;
  teams: Record<Side, string>;
  settings: MatchSettings;
  phase: MatchPhase;
  rounds: Round[];
  /** Working defense prompt each defender is editing. */
  drafts: Record<Side, string>;
  createdAt: number;
  finishedAt?: number;
  log: { at: number; event: string }[];
}

export interface DB {
  version: 1;
  teams: Team[];
  matches: Match[];
}

export interface ScoreLine {
  attack: number;
  defense: number;
  utility: number;
  total: number;
}
