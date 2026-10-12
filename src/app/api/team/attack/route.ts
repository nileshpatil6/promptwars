import { sendAttack } from "@/lib/game";
import { body, handle, teamId } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async (s) => {
    const { message } = await body<{ message?: string }>(req);
    return { turn: await sendAttack(teamId(s), String(message ?? "")) };
  }, "attacker");
}
