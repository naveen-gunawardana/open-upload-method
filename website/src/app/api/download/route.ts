import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

const ZIP_URL = "https://github.com/naveen-gunawardana/open-upload-method/releases/download/v1.0.0/oqm.zip";

export async function GET() {
  try {
    await supabaseServer().rpc("increment_download_count");
  } catch {
    // Don't block the download if the counter write fails.
  }
  return NextResponse.redirect(ZIP_URL);
}
