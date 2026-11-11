import { connection, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { usageCount } from "@/lib/usage-count";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  await connection();
  try {
    return NextResponse.json({ count: await usageCount(supabaseServer()) }, { headers });
  } catch {
    return NextResponse.json({ count: null }, { headers });
  }
}
