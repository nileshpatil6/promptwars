import { checkAdminPassword, setSession } from "@/lib/auth";
import { GameError } from "@/lib/game";
import { body, handle } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const { password } = await body<{ password?: string }>(req);
    if (!checkAdminPassword(String(password ?? ""))) throw new GameError("Wrong password", 401);
    await setSession({ t: "admin" });
    return { ok: true };
  });
}
