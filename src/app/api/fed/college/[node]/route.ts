import { connection } from "next/server";
import { isNodeId, NODE_META } from "@/lib/fed/config";
import { fedDb } from "@/lib/fed/db";
import { nodeCall, nodeHealth } from "@/lib/fed/nodes";
import { fail, ok } from "@/lib/fed/server";

type NodeStats = { roles: Record<string, number>; outcomes: Record<string, number>; top_companies: { company: string; count: number }[]; names_released: number };

const DAY = 86_400_000;

/** Placement-cell dashboard numbers for one college: engagement from the hub, residency facts from the college's own node. */
export async function GET(_req: Request, ctx: { params: Promise<{ node: string }> }) {
  await connection();
  const { node } = await ctx.params;
  if (!isNodeId(node)) return fail("Unknown college.", 404);
  const db = fedDb();
  const now = Date.now();
  const since14 = new Date(now - 14 * DAY).toISOString();

  const { data: people } = await db.from("fed_directory").select("pid").eq("node_id", node).limit(2000);
  const pids = (people ?? []).map((p) => p.pid as string);

  const { data: intros } = pids.length
    ? await db.from("fed_intros").select("id, status, created_at").in("requester", pids).gte("created_at", since14).limit(2000)
    : { data: [] };
  const ids = (intros ?? []).map((i) => i.id as string);
  const { data: hops } = ids.length ? await db.from("fed_hops").select("intro_id, status, sent_at, responded_at").in("intro_id", ids).limit(10000) : { data: [] };

  const since7 = now - 7 * DAY;
  const week = (intros ?? []).filter((i) => new Date(i.created_at as string).getTime() >= since7);
  const weekIds = new Set(week.map((i) => i.id));
  const weekHops = (hops ?? []).filter((h) => weekIds.has(h.intro_id) && (h.status === "accepted" || h.status === "declined"));
  const accepted = weekHops.filter((h) => h.status === "accepted").length;
  const waits = weekHops
    .filter((h) => h.sent_at && h.responded_at)
    .map((h) => (new Date(h.responded_at as string).getTime() - new Date(h.sent_at as string).getTime()) / 3_600_000)
    .sort((a, b) => a - b);
  const median = waits.length ? waits[Math.floor(waits.length / 2)] : null;

  const perDay = Array.from({ length: 14 }, (_, k) => {
    const start = now - (13 - k) * DAY;
    const label = new Date(start).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const count = (intros ?? []).filter((i) => {
      const t = new Date(i.created_at as string).getTime();
      return t >= start - DAY / 2 && t < start + DAY / 2;
    }).length;
    return { label, count };
  });

  const [{ data: audit }, health, stats, { data: top }] = await Promise.all([
    db.from("fed_audit").select("identifying_fields").eq("node_id", node).limit(100000),
    nodeHealth(node),
    nodeCall<NodeStats>(node, "GET", "/stats", undefined, { quiet: true }),
    db.from("fed_leaderboard").select("pid, role, grad_year, points, karz, score").eq("node_id", node).order("score", { ascending: false }).limit(5),
  ]);

  return ok({
    node,
    name: NODE_META[node].name,
    city: NODE_META[node].city,
    tiles: {
      introsThisWeek: week.length,
      acceptancePct: weekHops.length ? Math.round((accepted / weekHops.length) * 100) : null,
      medianResponseHours: median === null ? null : Math.round(median * 10) / 10,
      hires: week.filter((i) => i.status === "hired").length,
    },
    perDay,
    topHelpers: top ?? [],
    residency: {
      peopleOnServer: stats.ok ? Object.values(stats.data.roles).reduce((a, b) => a + b, 0) : health.people,
      identifyingFieldsToHub: (audit ?? []).reduce((a, r) => a + (r.identifying_fields as number), 0),
      hubAccess: health.reachable ? health.hubAccess : null,
      reachable: health.reachable,
      namesReleased: stats.ok ? stats.data.names_released : null,
      topCompanies: stats.ok ? stats.data.top_companies : [],
    },
  });
}
