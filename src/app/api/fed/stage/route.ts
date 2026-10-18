import { connection } from "next/server";
import { z } from "zod";
import { fedDb } from "@/lib/fed/db";
import { hopUrl } from "@/lib/fed/tokens";
import { secret, siteUrl } from "@/lib/fed/config";
import { cardLabel, fail, isStage, loadDirectory, ok } from "@/lib/fed/server";

/** Presenter control state: live intros with their pending hop links, and the QR toggles. */
export async function GET(req: Request) {
  await connection();
  if (!isStage(req)) return fail("Presenter only.", 403);
  const db = fedDb();
  const [{ data: intros }, { data: stageEvents }, dir] = await Promise.all([
    db.from("fed_intros").select("id, requester, target, status, success_prob, created_at").eq("is_history", false).order("created_at", { ascending: false }).limit(5),
    db.from("fed_events").select("text, id").eq("kind", "stage").order("id", { ascending: false }).limit(20),
    loadDirectory(),
  ]);
  const ids = (intros ?? []).map((i) => i.id);
  const { data: hops } = ids.length ? await db.from("fed_hops").select("id, intro_id, idx, to_pid, status, is_target").in("intro_id", ids).order("idx") : { data: [] };

  const latest = (prefix: string) => (stageEvents ?? []).find((e) => e.text.startsWith(prefix))?.text.endsWith(":on") ?? false;
  const site = siteUrl();
  return ok({
    siteUrl: site,
    joinQr: latest("qr_join"),
    hopQr: latest("qr_hop") || latest("qr_priya"),
    intros: (intros ?? []).map((i) => ({
      ...i,
      requester: dir.get(i.requester) ? cardLabel(dir.get(i.requester)!) : i.requester,
      target: dir.get(i.target) ? cardLabel(dir.get(i.target)!) : i.target,
      hops: (hops ?? [])
        .filter((h) => h.intro_id === i.id)
        .map((h) => {
          const d = dir.get(h.to_pid);
          return {
            id: h.id,
            idx: h.idx,
            status: h.status,
            isTarget: h.is_target,
            storyKey: d?.story_key ?? null,
            label: d ? cardLabel(d) : "",
            link: h.status === "sent" ? hopUrl(site, secret("HOP_TOKEN_SECRET"), h.id) : null,
          };
        }),
    })),
  });
}

const body = z.object({ action: z.enum(["qr_join:on", "qr_join:off", "qr_hop:on", "qr_hop:off", "qr_priya:on", "qr_priya:off"]) });

/** Shows or hides a full-screen QR on the projector. */
export async function POST(req: Request) {
  if (!isStage(req)) return fail("Presenter only.", 403);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Unknown action.", 400);
  await fedDb().rpc("fed_event", { p_kind: "stage", p_text: parsed.data.action, p_node: null, p_intro: null });
  return ok({ ok: true });
}
