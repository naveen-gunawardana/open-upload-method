import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

// The web converter reports each finished video here. It bumps the same counter the old app downloads used, so the
// number on the site carries on from where downloads left off. Nothing about the video itself is sent.
const MODES = new Set(["single", "ab"]);
const PER_DAY = 200;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const mode = body && typeof body === "object" && "mode" in body && typeof body.mode === "string" && MODES.has(body.mode) ? body.mode : null;
  if (!mode) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update(`${process.env.REVIEW_SALT ?? "oqm"}:${ip}`).digest("hex");
  const platform = `web-${mode}`;

  try {
    const db = supabaseServer();
    const { count, error: countError } = await db
      .from("download_events")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .like("platform", "web-%")
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= PER_DAY) return NextResponse.json({ ok: true, counted: false });

    const { error: incrementError } = await db.rpc("increment_download_count");
    if (incrementError) throw incrementError;
    const { error: insertError } = await db.from("download_events").insert({ platform, ip_hash: ipHash, country: request.headers.get("x-vercel-ip-country") });
    if (insertError) throw insertError;
    const { data, error: statsError } = await db.from("download_stats").select("count").eq("id", 1).single();
    if (statsError) throw statsError;
    return NextResponse.json({ ok: true, counted: true, count: data?.count ?? null });
  } catch {
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  }
}
