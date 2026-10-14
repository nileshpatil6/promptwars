import { createTeam, deleteTeam } from "@/lib/game";
import { body, handle } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body<{ name?: string; attacker?: string; defender?: string; ieee?: boolean }>(req);
    return { team: await createTeam({ ...b, name: String(b.name ?? "") }) };
  }, "admin");
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const { id } = await body<{ id?: string }>(req);
    await deleteTeam(String(id ?? ""));
  }, "admin");
}
