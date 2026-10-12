import { handle } from "@/lib/http";
import { teamView } from "@/lib/views";

export async function GET() {
  return handle(async (s) => {
    if (s?.t !== "team") return null;
    return teamView(s.id, s.role);
  }, "team");
}
