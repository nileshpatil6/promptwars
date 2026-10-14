import { submitClaim } from "@/lib/game";
import { body, handle, teamId } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async (s) => {
    const { guess } = await body<{ guess?: string }>(req);
    return { claim: await submitClaim(teamId(s), String(guess ?? "")) };
  }, "attacker");
}
