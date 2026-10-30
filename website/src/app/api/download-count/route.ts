import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = supabaseServer();
    const { data, error } = await supabase.from("download_stats").select("count").eq("id", 1).single();
    if (error) throw error;
    return NextResponse.json({ count: data?.count ?? null });
  } catch {
    return NextResponse.json({ count: null });
  }
}
