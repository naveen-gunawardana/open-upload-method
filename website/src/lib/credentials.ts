import { NextResponse } from "next/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Reads and checks { email, password } from a request body. Returns an error response if either is unusable. */
export async function readCredentials(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "Send your details as JSON." }, { status: 400 }) };
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const website = typeof body.website === "string" ? body.website : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return { error: NextResponse.json({ error: "Enter a valid email address." }, { status: 400 }) };
  }
  if (password.length < 8 || password.length > 72) {
    return { error: NextResponse.json({ error: "Use a password between 8 and 72 characters." }, { status: 400 }) };
  }
  return { email, password, bot: website.trim() !== "" };
}
