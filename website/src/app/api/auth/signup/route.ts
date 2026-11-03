import { NextResponse } from "next/server";
import { readCredentials } from "@/lib/credentials";
import { COOKIE, cookieOptions, makeToken } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase";

export async function POST(request: Request) {
  const creds = await readCredentials(request);
  if (creds.error) return creds.error;
  if (creds.bot) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400 });

  try {
    // email_confirm: true marks the address as confirmed, so there is no verification email to wait for.
    const { data, error } = await supabaseServer().auth.admin.createUser({
      email: creds.email,
      password: creds.password,
      email_confirm: true,
    });
    if (error) {
      const exists = error.code === "email_exists" || /already|registered/i.test(error.message);
      if (exists) return NextResponse.json({ error: "That email already has an account. Log in instead." }, { status: 409 });
      throw error;
    }
    const res = NextResponse.json({ ok: true, email: data.user.email });
    res.cookies.set(COOKIE, makeToken({ id: data.user.id, email: data.user.email ?? creds.email }), cookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "We couldn't create your account. Please try again in a moment." }, { status: 500 });
  }
}
