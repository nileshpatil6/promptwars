"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/client";
import { Brand, Spinner } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [role, setRole] = useState<"attacker" | "defender" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return setError("Pick your role first");
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/team", { body: { code, role } });
      router.push("/play");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh lg:grid-cols-2">
      <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_70%)]" />
      <section className="relative flex flex-col justify-between border-line p-6 md:p-10 lg:border-r">
        <Brand />
        <div className="py-16">
          <div className="eyebrow">Team check-in</div>
          <h1 className="display mt-4 text-[clamp(64px,9vw,140px)]">
            Choose
            <br />
            your <span className={role === "defender" ? "text-blue" : "text-red"}>side.</span>
          </h1>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-paper-2">
            Both teammates sign in with the same team code from their own device. One takes the attack console, the other
            the defense console.
          </p>
        </div>
        <div className="eyebrow !text-[10px]">15 Oct 2026 · EC Dept, Class 133</div>
      </section>

      <section className="relative flex items-center p-6 md:p-10">
        <form onSubmit={submit} className="mx-auto w-full max-w-md">
          <label className="eyebrow block" htmlFor="code">
            Team code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="XXXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="field mt-3 !h-20 !text-center !text-4xl !tracking-[0.5em]"
          />

          <div className="eyebrow mt-10">Your role</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                ["attacker", "Attacker", "Extract their secret", "red"],
                ["defender", "Defender", "Guard your secret", "blue"],
              ] as const
            ).map(([r, t, d, tone]) => {
              const on = role === r;
              return (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  aria-pressed={on}
                  className={`group relative border p-5 text-left transition-colors ${
                    on
                      ? tone === "red"
                        ? "border-red bg-red/10"
                        : "border-blue bg-blue/10"
                      : "border-line-2 hover:border-paper-2"
                  }`}
                >
                  <span className={`absolute right-4 top-4 size-2.5 border ${on ? (tone === "red" ? "border-red bg-red" : "border-blue bg-blue") : "border-line-2"}`} />
                  <div className={`display text-4xl ${on ? (tone === "red" ? "text-red" : "text-blue") : ""}`}>{t}</div>
                  <div className="mt-2 text-[13px] text-paper-2">{d}</div>
                </button>
              );
            })}
          </div>

          {error && <div className="mt-6 border-l-2 border-red pl-3 font-mono text-[13px] text-red">{error}</div>}

          <button type="submit" disabled={busy || code.length < 6 || !role} className={`btn mt-8 w-full !h-14 ${role === "defender" ? "btn-blue" : "btn-red"}`}>
            {busy ? <Spinner /> : "Enter the arena"}
          </button>
          <p className="mt-4 text-center text-[12px] text-mute">Don&apos;t have a code? Ask the organizers at the desk.</p>
        </form>
      </section>
    </main>
  );
}
