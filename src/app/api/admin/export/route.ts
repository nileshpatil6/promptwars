import { getSession } from "@/lib/auth";
import { tick } from "@/lib/game";
import { leaderboard } from "@/lib/scoring";
import { db } from "@/lib/store";

/** Full platform log: the official record per the rulebook. */
export async function GET() {
  const s = await getSession();
  if (s?.t !== "admin") return new Response("Unauthorized", { status: 401 });
  tick();
  const payload = { exportedAt: new Date().toISOString(), standings: leaderboard(db()), ...db() };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="promptwar-log-${Date.now()}.json"`,
    },
  });
}
