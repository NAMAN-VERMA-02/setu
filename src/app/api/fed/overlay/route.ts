import { connection } from "next/server";
import { fedDb } from "@/lib/fed/db";
import { hopUrl } from "@/lib/fed/tokens";
import { secret, siteUrl } from "@/lib/fed/config";
import { cardLabel, loadDirectory, ok } from "@/lib/fed/server";

/**
 * What the projector should overlay right now: the join QR, or the QR of whoever is being asked at this moment
 * (so a guest can scan it and play that person). Both are things the presenter chose to put on a big screen anyway.
 */
export async function GET() {
  await connection();
  const db = fedDb();
  const { data: stage } = await db.from("fed_events").select("text").eq("kind", "stage").order("id", { ascending: false }).limit(30);
  const flag = (prefix: string) => (stage ?? []).find((e) => e.text.startsWith(prefix))?.text.endsWith(":on") ?? false;
  const joinQr = flag("qr_join");
  const hopOn = flag("qr_hop") || flag("qr_priya"); // qr_priya is the older name for the same switch

  let hop: { link: string; label: string } | null = null;
  if (hopOn) {
    const dir = await loadDirectory();
    const { data: sent } = await db
      .from("fed_hops")
      .select("id, to_pid, sent_at, fed_intros!inner(is_history)")
      .eq("status", "sent")
      .eq("fed_intros.is_history", false)
      .order("sent_at", { ascending: false })
      .limit(10);
    // only demo personas can be played from a QR; a real person's pending ask is never exposed
    const row = (sent ?? []).find((h) => dir.get(h.to_pid)?.story_key);
    if (row) hop = { link: hopUrl(siteUrl(), secret("HOP_TOKEN_SECRET"), row.id), label: cardLabel(dir.get(row.to_pid)!) };
  }
  return ok({ joinQr, hop, siteUrl: siteUrl() });
}
