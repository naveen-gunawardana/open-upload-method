import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

// The desktop app reports each finished patch here. Only these few anonymous fields are accepted.
const OSES = new Set(["darwin", "win32", "linux"]);
const CODECS = new Set(["h264", "h265"]);
const PER_DAY = 500;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const { install_id, app_version, os, codec, ok, size_mb } = body;
  if (
    typeof install_id !== "string" || !/^[a-f0-9]{32}$/.test(install_id) ||
    typeof app_version !== "string" || !/^\d{1,3}(\.\d{1,3}){1,3}$/.test(app_version) ||
    typeof os !== "string" || !OSES.has(os) ||
    typeof codec !== "string" || !CODECS.has(codec) ||
    typeof ok !== "boolean" ||
    !Number.isInteger(size_mb) || (size_mb as number) < 0 || (size_mb as number) > 200_000
  ) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  try {
    const db = supabaseServer();
    const { count, error: countError } = await db
      .from("patch_events")
      .select("id", { count: "exact", head: true })
      .eq("install_id", install_id)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= PER_DAY) return NextResponse.json({ error: "slow down" }, { status: 429 });

    const { error } = await db
      .from("patch_events")
      .insert({ install_id, app_version, os, codec, ok, size_mb, country: request.headers.get("x-vercel-ip-country") });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  }
}
