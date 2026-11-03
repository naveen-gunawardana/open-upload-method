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
  try {
    await supabaseServer().rpc("increment_download_count");
  } catch {
    // Don't block the download if the counter write fails.
  }
  return NextResponse.redirect(ASSETS[platform] ?? SOURCE_ZIP);
}
