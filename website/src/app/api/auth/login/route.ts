import { NextResponse } from "next/server";
import { readCredentials } from "@/lib/credentials";
import { COOKIE, cookieOptions, makeToken } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase";

export async function POST(request: Request) {
  const creds = await readCredentials(request);
  if (creds.error) return creds.error;

  try {
    const { data, error } = await supabaseServer().auth.signInWithPassword({ email: creds.email, password: creds.password });
    if (error || !data.user) {
      // Same message whether the email or the password was wrong.
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, email: data.user.email });
    res.cookies.set(COOKIE, makeToken({ id: data.user.id, email: data.user.email ?? creds.email }), cookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "We couldn't log you in. Please try again in a moment." }, { status: 500 });
  }
}
