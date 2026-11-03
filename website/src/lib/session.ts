import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// A small signed cookie says who is logged in. The accounts themselves live in Supabase Auth.
export const COOKIE = "oqm_session";
const DAYS = 30;

export type Session = { id: string; email: string };

function sign(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createHmac("sha256", createHmac("sha256", "oqm-session").update(secret).digest()).update(payload).digest("base64url");
}

export function makeToken(session: Session) {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + DAYS * 86_400_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.id !== "string" || typeof data.email !== "string" || !(data.exp > Date.now())) return null;
    return { id: data.id, email: data.email };
  } catch {
    return null;
  }
}

export async function getSession() {
  return readToken((await cookies()).get(COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DAYS * 86_400,
};
