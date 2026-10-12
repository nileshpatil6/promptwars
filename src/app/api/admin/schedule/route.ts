import { generateSchedule } from "@/lib/game";
import { body, handle } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const { perTeam } = await body<{ perTeam?: number }>(req);
    return { created: generateSchedule(Math.max(1, Math.min(6, Number(perTeam) || 3))).length };
  }, "admin");
}
