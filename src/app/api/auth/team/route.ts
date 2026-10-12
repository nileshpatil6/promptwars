import { setSession } from "@/lib/auth";
import { GameError } from "@/lib/game";
import { body, handle } from "@/lib/http";
import { db } from "@/lib/store";

export async function POST(req: Request) {
  return handle(async () => {
    const { code, role } = await body<{ code?: string; role?: string }>(req);
    const t = db().teams.find((x) => x.code === String(code ?? "").trim().toUpperCase());
    if (!t) throw new GameError("That team code doesn't exist", 401);
    if (role !== "attacker" && role !== "defender") throw new GameError("Pick a role");
    await setSession({ t: "team", id: t.id, role });
    return { ok: true, team: t.name, role };
  });
}
