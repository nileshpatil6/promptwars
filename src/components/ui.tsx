"use client";

import Link from "next/link";
import type { MatchPhase, MeterCell } from "@/lib/view-types";
import { useNow } from "./client";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <Mark />
      {!compact && (
        <span className="leading-none">
          <span className="display block text-[15px] tracking-[0.02em]">Prompt Injection War</span>
          <span className="eyebrow mt-1 block !text-[9px]">IEEE SGBIT · IEEE Week 2026</span>
        </span>
      )}
    </Link>
  );
}

/** Two opposing brackets: red attack, blue defense, meeting at a redacted bar. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <path d="M11 4H4v24h7" fill="none" stroke="var(--color-red)" strokeWidth="3" />
      <path d="M21 4h7v24h-7" fill="none" stroke="var(--color-blue)" strokeWidth="3" />
      <rect x="9" y="13.5" width="14" height="5" fill="var(--color-paper)" />
    </svg>
  );
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function Clock({
  endsAt,
  skew = 0,
  className = "",
  idle = "--:--",
}: {
  endsAt: number | null;
  skew?: number;
  className?: string;
  idle?: string;
}) {
  const now = useNow(skew);
  if (!endsAt) return <span className={`font-mono tabular-nums ${className}`}>{idle}</span>;
  const left = endsAt - now;
  const urgent = left < 30_000;
  return (
    <span className={`font-mono tabular-nums ${urgent ? "text-red" : ""} ${className}`}>
      {fmtClock(left)}
    </span>
  );
}

const PHASE: Record<MatchPhase, { label: string; cls: string }> = {
  lobby: { label: "Prep", cls: "text-paper-2" },
  live: { label: "Live", cls: "text-red border-red/50" },
  break: { label: "Intermission", cls: "text-amber border-amber/40" },
  done: { label: "Final", cls: "text-mute" },
};

export function PhaseChip({ phase }: { phase: MatchPhase }) {
  const p = PHASE[phase];
  return (
    <span className={`chip ${p.cls}`}>
      {phase === "live" && <span className="size-1.5 animate-blink rounded-full bg-red" />}
      {p.label}
    </span>
  );
}

/** Fragment-by-fragment leak meter: redaction bars that crack open as a secret leaks. */
export function Meter({
  cells,
  tone = "red",
  size = "md",
  showValues = true,
}: {
  cells: MeterCell[];
  tone?: "red" | "blue";
  size?: "sm" | "md" | "lg";
  showValues?: boolean;
}) {
  const h = size === "lg" ? "h-14" : size === "sm" ? "h-7" : "h-10";
  const text = size === "lg" ? "text-lg" : size === "sm" ? "text-[10px]" : "text-[13px]";
  const fill = tone === "red" ? "bg-red" : "bg-blue";
  if (!cells.length)
    return (
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`redact ${h} flex-1 opacity-40`} />
        ))}
      </div>
    );
  return (
    <div className="flex gap-1.5">
      {cells.map((c, i) => (
        <div
          key={i}
          className={`relative ${h} overflow-hidden ${c.kind === "number" ? "flex-[0.8]" : "flex-[1.2]"} ${
            c.level >= 1 ? "border border-red" : "redact"
          }`}
        >
          <div
            className={`absolute inset-y-0 left-0 ${fill} transition-[width] duration-700 ease-out ${c.level >= 1 ? "opacity-100" : "opacity-70"}`}
            style={{ width: `${c.level * 100}%` }}
          />
          <div className={`relative flex h-full items-center justify-center px-2 font-mono font-semibold tracking-[0.18em] ${text}`}>
            {c.value && showValues ? (
              <span className={c.level >= 1 ? "text-ink" : "text-paper"}>{c.value}</span>
            ) : (
              <span className={c.level > 0 ? "text-ink/80" : "text-faint"}>
                {c.level > 0 ? `${Math.round(c.level * 100)}%` : "█".repeat(Math.min(c.length, 8))}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "red" | "blue" | "paper" }) {
  const c = tone === "red" ? "text-red" : tone === "blue" ? "text-blue" : "text-paper";
  return (
    <div>
      <div className="eyebrow !text-[10px]">{label}</div>
      <div className={`mt-1 font-mono text-xl tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex gap-1 ${className}`} aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1 animate-blink bg-current" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

export function Empty({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="panel ticks mx-auto max-w-xl p-10 text-center">
      <div className="display text-4xl">{title}</div>
      {body && <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-paper-2">{body}</p>}
      {children && <div className="mt-6 flex justify-center gap-3">{children}</div>}
    </div>
  );
}
