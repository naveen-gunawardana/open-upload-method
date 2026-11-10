import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

// Reviews are only collected for now. They are saved with approved = false; nothing here (or on the site) reads them back.
const MAX_TEXT = 1000;
const MAX_NAME = 60;
const PER_HOUR = 3;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send your review as JSON." }, { status: 400 });
  }

  // Hidden field real people never fill in. Pretend it worked so bots don't retry.
  if (typeof body.website === "string" && body.website.trim() !== "") return NextResponse.json({ ok: true });

  const rating = Number(body.rating);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Pick a rating from 1 to 5 stars." }, { status: 400 });
  }
  if (text.length < 1 || text.length > MAX_TEXT) {
    return NextResponse.json({ error: `Write a review up to ${MAX_TEXT} characters.` }, { status: 400 });
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: `Keep your @username under ${MAX_NAME} characters.` }, { status: 400 });
  }

  // Only a salted hash of the IP is kept, just enough to limit how fast one person can post.
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update(`${process.env.REVIEW_SALT ?? "oqm"}:${ip}`).digest("hex");

  try {
    const db = supabaseServer();
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count, error: countError } = await db
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= PER_HOUR) {
      return NextResponse.json({ error: "You've sent a few reviews already. Try again in an hour." }, { status: 429 });
    }
    const { error } = await db.from("reviews").insert({ rating, text, name: name || null, ip_hash: ipHash });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "We couldn't save your review. Please try again in a moment." }, { status: 500 });
  }
}
