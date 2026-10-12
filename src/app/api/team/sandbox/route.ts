import { GameError, sandboxChat } from "@/lib/game";
import { body, handle, teamId } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async (s) => {
    const b = await body<{ defense?: string; history?: { role: "user" | "model"; text: string }[]; secret?: string }>(req);
    const history = (Array.isArray(b.history) ? b.history : []).filter(
      (h) => (h.role === "user" || h.role === "model") && typeof h.text === "string",
    );
    if (!history.length || history[history.length - 1].role !== "user") throw new GameError("Send a message to test");
    return sandboxChat(teamId(s), String(b.defense ?? ""), history, b.secret);
  }, "defender");
}
