import { connection } from "next/server";
import { fedDb } from "@/lib/fed/db";
import { hopUrl } from "@/lib/fed/tokens";
import { secret, siteUrl } from "@/lib/fed/config";
import { fail, getSession, isStage, loadDirectory, ok, publicCard, viewerTokensFor } from "@/lib/fed/server";

/** Live state of one intro: hops, people (role words only), events, and the viewer tokens to read names from nodes. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Unknown intro.", 404);
  const db = fedDb();
  const [{ data: intro }, { data: hops }, { data: events }, dir, session] = await Promise.all([
    db.from("fed_intros").select("*").eq("id", id).maybeSingle(),
    db.from("fed_hops").select("*").eq("intro_id", id).order("idx"),
    db.from("fed_events").select("id, kind, text, created_at").eq("intro_id", id).order("id"),
    loadDirectory(),
    getSession(),
  ]);
  if (!intro) return fail("Unknown intro.", 404);

  const pids = new Set<string>([intro.requester, intro.target, ...(hops ?? []).flatMap((h) => [h.from_pid, h.to_pid])]);
  const people = [...pids].map((p) => dir.get(p)).filter(Boolean).map((d) => publicCard(d!));

  const { data: edgeRows } = await db.from("fed_graph").select("a, b, p").in("a", [...pids]).in("b", [...pids]);
  const stage = isStage(req);
  const links = stage
    ? Object.fromEntries((hops ?? []).filter((h) => h.status === "sent").map((h) => [h.id, hopUrl(siteUrl(), secret("HOP_TOKEN_SECRET"), h.id)]))
    : {};

  return ok({
    intro,
    hops,
    events,
    people,
    edges: (edgeRows ?? []).map((e) => ({ a: e.a, b: e.b, p: e.p })),
    isRequester: session?.pid === intro.requester,
    // the requester (or the stage) reads names from the colleges with these
    viewer: session && session.pid === intro.requester ? viewerTokensFor(session.pid) : stage ? viewerTokensFor(intro.requester) : null,
    links,
  });
}
