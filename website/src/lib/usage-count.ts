import type { SupabaseClient } from "@supabase/supabase-js";

/** Preserve the existing shared total and include successful desktop reports, old and new.
 * Desktop events never increment download_stats: summing them here avoids a backfill or double counting.
 */
export async function usageCount(db: SupabaseClient): Promise<number | null> {
  const [base, desktop] = await Promise.all([
    db.from("download_stats").select("count").eq("id", 1).single(),
    db.from("patch_events").select("id", { count: "exact", head: true }).eq("ok", true),
  ]);
  if (base.error) throw base.error;
  if (desktop.error) throw desktop.error;
  if (base.data?.count == null || desktop.count == null) return null;
  const total = Number(base.data.count) + desktop.count;
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Invalid usage count");
  return total;
}
