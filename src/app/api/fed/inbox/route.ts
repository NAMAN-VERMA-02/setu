import { connection } from "next/server";
import { fedDb } from "@/lib/fed/db";
import { hopUrl } from "@/lib/fed/tokens";
import { secret, siteUrl } from "@/lib/fed/config";
import { cardLabel, fail, loadDirectory, ok } from "@/lib/fed/server";

/** A demo persona's inbox (teammate phones). Only story personas can be opened this way. */
export async function GET(req: Request) {
  await connection();
  const as = new URL(req.url).searchParams.get("as") ?? "";
  const dir = await loadDirectory();
  const me = [...dir.values()].find((d) => d.story_key === as);
  if (!me) return fail("Unknown persona. Ask the presenter to reset the demo.", 404);

  const { data: hops } = await fedDb()
    .from("fed_hops")
    .select("id, intro_id, status, is_target, idx, sent_at, responded_at")
    .eq("to_pid", me.pid)
    .order("sent_at", { ascending: false, nullsFirst: false })
    .limit(20);
  const introIds = [...new Set((hops ?? []).map((h) => h.intro_id))];
  const { data: intros } = introIds.length ? await fedDb().from("fed_intros").select("id, requester, target, status, is_history").in("id", introIds) : { data: [] };
  const byId = new Map((intros ?? []).map((i) => [i.id, i]));

  const items = (hops ?? [])
    .filter((h) => !byId.get(h.intro_id)?.is_history)
    .filter((h) => h.status !== "waiting")
    .map((h) => {
      const intro = byId.get(h.intro_id)!;
      const req = dir.get(intro.requester);
      const tgt = dir.get(intro.target);
      return {
        hopId: h.id,
        status: h.status,
        isTarget: h.is_target,
        introStatus: intro.status,
        from: req ? cardLabel(req) : "someone",
        to: tgt ? cardLabel(tgt) : "someone",
        sentAt: h.sent_at,
        link: hopUrl(siteUrl(), secret("HOP_TOKEN_SECRET"), h.id),
      };
    });
  return ok({ persona: { key: as, label: cardLabel(me) }, items });
}
