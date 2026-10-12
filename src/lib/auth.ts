import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./config";
import { db } from "./store";
import type { Role } from "./types";

export type Session = { t: "team"; id: string; role: Role } | { t: "admin" };

const COOKIE = "pw_session";

const sign = (data: string) => crypto.createHmac("sha256", env.sessionSecret).update(data).digest("base64url");

export function encode(s: Session) {
  const data = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decode(token?: string): Session | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const s = decode((await cookies()).get(COOKIE)?.value);
  if (s?.t === "team" && !db().teams.some((t) => t.id === s.id)) return null;
  return s;
}

export async function setSession(s: Session) {
  (await cookies()).set(COOKIE, encode(s), {
    httpOnly: true,
    sameSite: "lax",
    // Off by default so the app works over plain http on a venue LAN.
    secure: process.env.SECURE_COOKIES === "1",
    path: "/",
    maxAge: 60 * 60 * 14,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export function checkAdminPassword(pw: string) {
  const a = Buffer.from(pw);
  const b = Buffer.from(env.adminPassword);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
