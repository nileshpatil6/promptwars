import { handle } from "@/lib/http";
import { arenaView } from "@/lib/views";

export async function GET() {
  return handle(async (session) => arenaView(session?.t === "admin"));
}
