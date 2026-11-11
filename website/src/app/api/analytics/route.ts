import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { clientEnvironment, sanitizeAnalytics } from "@/lib/conversion-analytics";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 16384) return new NextResponse(null, { status: 413 });
  let event;
  try {
    const text = await request.text();
    if (text.length > 16384) return new NextResponse(null, { status: 413 });
    event = sanitizeAnalytics(JSON.parse(text));
  } catch { return new NextResponse(null, { status: 400 }); }
  if (!event) return new NextResponse(null, { status: 400 });
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ip_hash = createHash("sha256").update(`${process.env.REVIEW_SALT ?? "oqm"}:${ip}`).digest("hex");
  try {
    const db = supabaseServer();
    const { count, error: limitError } = await db.from("conversion_analytics").select("id", { count: "exact", head: true })
      .eq("ip_hash", ip_hash).gte("created_at", new Date(Date.now() - 86400000).toISOString());
    if (limitError) throw limitError;
    if ((count ?? 0) >= 1000) return new NextResponse(null, { status: 429 });
    const { error } = await db.from("conversion_analytics").upsert({ ...event, ip_hash,
      country: request.headers.get("x-vercel-ip-country")?.match(/^[A-Z]{2}$/)?.[0] ?? null,
      ...clientEnvironment(request.headers.get("user-agent") ?? "") }, { onConflict: "run_id,event", ignoreDuplicates: true });
    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch {
    console.error("Conversion analytics could not be saved");
    return NextResponse.json({ error: "could not save analytics" }, { status: 503 });
  }
}
