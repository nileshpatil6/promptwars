import { saveDraft } from "@/lib/game";
import { body, handle, teamId } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async (s) => {
    const { text } = await body<{ text?: string }>(req);
    return { draft: await saveDraft(teamId(s), String(text ?? "")) };
  }, "defender");
}
