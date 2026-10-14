import { createMatch, deleteMatch, endRoundNow, extendRound, GameError, runUtility, startRound, match } from "@/lib/game";
import { body, handle } from "@/lib/http";
import type { MatchSettings } from "@/lib/types";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<{ a?: string; b?: string; label?: string; settings?: Partial<MatchSettings> }>(req);
    return { match: await createMatch(String(b.a ?? ""), String(b.b ?? ""), { label: b.label, settings: b.settings }) };
  }, "admin");
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const b = await body<{ id?: string; action?: string; seconds?: number }>(req);
    const id = String(b.id ?? "");
    switch (b.action) {
      case "start":
        return void (await startRound(id));
      case "end":
        return endRoundNow(id);
      case "extend":
        return extendRound(id, Math.max(10, Math.min(600, Number(b.seconds) || 60)));
      case "delete":
        return deleteMatch(id);
      case "regrade": {
        const m = match(id);
        await Promise.all(m.rounds.flatMap((r) => (["a", "b"] as const).map((s) => runUtility(id, r.index, s))));
        return;
      }
      default:
        throw new GameError("Unknown action");
    }
  }, "admin");
}
