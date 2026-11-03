import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

const REPO = "https://github.com/naveen-gunawardana/open-upload-method";
const LATEST = `${REPO}/releases/latest/download`;
const SOURCE_ZIP = `${REPO}/releases/download/v1.0.0/oqm.zip`;

// Every download link on the site goes through here so the counter sees all of them.
const ASSETS: Record<string, string> = {
  mac: `${LATEST}/OQM-mac-apple-silicon.zip`,
  "mac-intel": `${LATEST}/OQM-mac-intel.zip`,
  windows: `${LATEST}/OQM-windows.zip`,
  source: SOURCE_ZIP,
};

export async function GET(request: Request) {
  const platform = new URL(request.url).searchParams.get("platform") ?? "source";
  // One row per download. The IP is stored only as a salted hash: enough to count unique visitors, not to identify anyone.
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update(`${process.env.REVIEW_SALT ?? "oqm"}:${ip}`).digest("hex");
  const country = request.headers.get("x-vercel-ip-country");

  try {
    const db = supabaseServer();
    await db.rpc("increment_download_count");
    await db.from("download_events").insert({ platform, ip_hash: ipHash, country });
  } catch {
    // Don't block the download if the counter or log write fails.
  }
  return NextResponse.redirect(ASSETS[platform] ?? SOURCE_ZIP);
}
