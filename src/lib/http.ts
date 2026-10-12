import { NextResponse } from "next/server";
import { getSession, type Session } from "./auth";
import { GameError } from "./game";

type Handler = (session: Session | null) => Promise<unknown>;

export async function handle(fn: Handler, need?: "team" | "admin" | "attacker" | "defender") {
  try {
    const session = await getSession();
    if (need === "admin" && session?.t !== "admin") throw new GameError("Organizer login required", 401);
    if (need && need !== "admin") {
      if (session?.t !== "team") throw new GameError("Team login required", 401);
      if (need !== "team" && session.role !== need) throw new GameError(`Only the ${need} can do that`, 403);
    }
    const data = await fn(session);
    return NextResponse.json(data ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new GameError("Invalid request body");
  }
}

export const teamId = (s: Session | null) => (s as Extract<Session, { t: "team" }>).id;
