import { connection } from "next/server";
import { z } from "zod";
import { findRoutes } from "@/lib/fed/bridge";
import { isNodeId, nodeConfig, secret } from "@/lib/fed/config";
import { fedDb } from "@/lib/fed/db";
import { nodeCall } from "@/lib/fed/nodes";
import { cardLabel, fail, loadDirectory, loadGraph, ok, publicCard, viewerTokensFor } from "@/lib/fed/server";
import { mintViewerToken, verifyHopToken } from "@/lib/fed/tokens";

async function loadHop(token: string) {
  const hopId = verifyHopToken(secret("HOP_TOKEN_SECRET"), token);
  if (!hopId) return null;
  const db = fedDb();
  const { data: hop } = await db.from("fed_hops").select("*").eq("id", hopId).maybeSingle();
  if (!hop) return null;
  const { data: intro } = await db.from("fed_intros").select("*").eq("id", hop.intro_id).maybeSingle();
  if (!intro) return null;
  return { hop, intro };
}

/** Everything the phone page needs: who is asking (role words), where we are on the path, and how to read the ask. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await ctx.params;
  const loaded = await loadHop(token);
  if (!loaded) return fail("This link is not valid.", 404);
  const { hop, intro } = loaded;
  const [dir, { data: hops }, { data: events }] = await Promise.all([
    loadDirectory(),
    fedDb().from("fed_hops").select("idx, status, is_target, to_pid").eq("intro_id", intro.id).order("idx"),
    fedDb().from("fed_events").select("id, kind, text, created_at").eq("intro_id", intro.id).order("id"),
  ]);
  const me = dir.get(hop.to_pid);
  const requester = dir.get(intro.requester);
  const target = dir.get(intro.target);
  if (!me || !requester || !target) return fail("This link is not valid.", 404);

  const live = (hops ?? []).filter((h) => h.status !== "cancelled");
  const position = live.findIndex((h) => h.to_pid === hop.to_pid && h.idx === hop.idx) + 1;
  const requesterCfg = isNodeId(requester.node_id) ? nodeConfig(requester.node_id) : null;

  return ok({
    hop: { id: hop.id, status: hop.status, isTarget: hop.is_target, position, total: live.length },
    intro: { id: intro.id, status: intro.status, trustStep: intro.trust_step, workSeen: intro.work_seen, response: intro.response },
    me: { ...publicCard(me), storyKey: me.story_key },
    requester: { ...publicCard(requester), label: cardLabel(requester) },
    target: publicCard(target),
    events,
    // lets this person's browser read the requester's name and ask straight from the requester's college node
    read: requesterCfg
      ? {
          url: process.env[`NEXT_PUBLIC_NODE_${requester.node_id.toUpperCase()}_URL`] ?? requesterCfg.baseUrl,
          token: mintViewerToken(requesterCfg.viewerSecret, hop.to_pid),
          requesterPid: requester.pid,
          node: requester.node_id,
        }
      : null,
    viewer: viewerTokensFor(hop.to_pid),
  });
}

const action = z.object({ accept: z.boolean(), response: z.enum(["question", "call", "referral"]).optional() });

/** Yes or no on one hop. A no is silent for the requester; the route is recomputed from the last person who said yes. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const loaded = await loadHop(token);
  if (!loaded) return fail("This link is not valid.", 404);
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Choose yes or no.", 400);
  const { hop, intro } = loaded;
  const db = fedDb();

  let response = parsed.data.response;
  if (parsed.data.accept && hop.is_target && response === "referral" && !intro.work_seen) {
    return fail("A referral unlocks only after the requester's work has been seen. Choose a call or a question.", 409);
  }
  if (!hop.is_target) response = undefined;

  const { data: result, error } = await db.rpc("fed_respond_hop", { p_hop: hop.id, p_accept: parsed.data.accept, p_response: response ?? null });
  if (error) return fail("We could not record that. Please try again.", 500);
  const r = result as { ok: boolean; idempotent?: boolean; status?: string; accepted_pid?: string; next_hop?: string | null; delivered?: boolean; reroute?: boolean; from_pid?: string };
  if (!r.ok) return ok({ ok: true, already: r.status });

  const dir = await loadDirectory();
  if (r.accepted_pid) {
    // the person who said yes becomes visible to the requester and to the next person on the path
    const mine = dir.get(r.accepted_pid);
    if (mine && isNodeId(mine.node_id)) {
      const { data: nextHop } = r.next_hop ? await db.from("fed_hops").select("to_pid").eq("id", r.next_hop).maybeSingle() : { data: null };
      const viewers = [intro.requester, ...(nextHop ? [nextHop.to_pid] : [])];
      await nodeCall(mine.node_id, "POST", "/reveal", { pid: r.accepted_pid, viewer_pids: viewers });
    }
    return ok({ ok: true, accepted: true, delivered: !!r.delivered, response: response ?? null });
  }

  // Declined: find another route from the last accepted person, never through anyone who declined.
  const { data: all } = await db.from("fed_hops").select("from_pid, to_pid, status").eq("intro_id", intro.id);
  const declined = (all ?? []).filter((h) => h.status === "declined").map((h) => h.to_pid as string);
  const accepted = (all ?? []).filter((h) => h.status === "accepted").map((h) => h.to_pid as string);
  const source = accepted.at(-1) ?? intro.requester;
  const { edges, offlinePids } = await loadGraph();
  const { best } = findRoutes({
    source,
    target: intro.target,
    edges,
    exclude: [...declined, ...offlinePids, intro.requester, ...accepted.filter((p) => p !== source)],
  });

  let overall: number | null = null;
  if (best) {
    // The hops already done are shown at their original chance, so the story reads 0.9 × 0.7 × 0.6 = 0.378
    // (the live estimate in fed_graph moves slightly after every yes, which is right for routing but noisy to show).
    const chain = [intro.requester, ...accepted];
    const { data: priors } = await db.from("fed_edges").select("a, b, prior").in("a", chain).in("b", chain);
    const priorOf = (a: string, b: string) => priors?.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))?.prior ?? 1;
    const done = chain.slice(0, -1).reduce((m, p, i) => m * priorOf(p, chain[i + 1]), 1);
    overall = done * best.prob;
  }
  await db.rpc("fed_reroute", { p_intro: intro.id, p_tail: best?.path ?? null, p_prob: overall });
  return ok({ ok: true, accepted: false, rerouted: !!best });
}
