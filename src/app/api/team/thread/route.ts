import { newThread } from "@/lib/game";
import { handle, teamId } from "@/lib/http";

export async function POST() {
  return handle(async (s) => newThread(teamId(s)), "attacker");
}
