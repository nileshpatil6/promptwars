import type { MatchSettings } from "./types";

export const DEFAULT_SETTINGS: MatchSettings = {
  rounds: 3,
  roundSeconds: 300,
  maxMessages: 20,
  maxClaims: 3,
  maxDefenseChars: 1500,
  maxAttackChars: 800,
  probesPerRound: 3,
};

/** Points available per match, straight from the rulebook. */
export const POINTS = { attack: 40, defense: 40, utility: 20 } as const;

/** Seconds of grace after the buzzer for in-flight attack messages. */
export const GRACE_SECONDS = 3;

export const env = {
  apiKey: process.env.GEMINI_API_KEY || "",
  model: process.env.GEMINI_MODEL || "gemini-flash-latest",
  judgeModel: process.env.GEMINI_JUDGE_MODEL || process.env.GEMINI_MODEL || "gemini-flash-latest",
  adminPassword: process.env.ADMIN_PASSWORD || "admin",
  sessionSecret: process.env.SESSION_SECRET || "dev-insecure-session-secret",
};

export const demoMode = () => !env.apiKey;
