import { connection } from "next/server";
import { z } from "zod";
import { findRoutes } from "@/lib/fed/bridge";
import { NODE_IDS } from "@/lib/fed/config";
import { nodeCall } from "@/lib/fed/nodes";
import { cardLabel, fail, getSession, loadGraph, ok } from "@/lib/fed/server";
import { DOMAIN_LABEL } from "@/lib/fed/taxonomy";

type Match = {
  pid: string;
  score: number;
  domain: string | null;
  title: string | null;
  company: string | null;
  years_exp: number | null;
  grad_year: number | null;
  role: string;
  offers: string[];
  open_to: string[];
  reasons: string[];
};

const body = z.object({ query: z.string().trim().min(2).max(300) });

/**
 * Find: say who you need in plain words (any profession), and every online server answers with the people who
 * offer it. Only public fields come back. For each person we also show the chance of your warmest route to them.
 */
export async function POST(req: Request) {
  await connection();
  const session = await getSession();
  if (!session) return fail("Pick a persona or join first.", 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Say who you need in a few words.", 400);

  const graph = await loadGraph();
  const targets = NODE_IDS.filter((id) => !graph.offlineNodes.has(id));
  const replies = await Promise.all(
    targets.map(async (id) => ({ id, r: await nodeCall<Match[]>(id, "POST", "/match", { query: parsed.data.query, limit: 6, exclude_pid: session.pid }) })),
  );

  const merged = replies
    .flatMap(({ id, r }) => (r.ok ? r.data.map((m) => ({ ...m, node: id })) : []))
    .filter((m) => m.pid !== session.pid)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const results = merged.map((m) => {
    const d = graph.directory.get(m.pid);
    const route = findRoutes({ source: session.pid, target: m.pid, edges: graph.edges, exclude: [...graph.offlinePids] }).best;
    return {
      pid: m.pid,
      node: m.node,
      score: m.score,
      percent: Math.round(m.score * 100),
      label: d ? cardLabel(d) : m.title ?? "Professional",
      title: m.title,
      company: m.company,
      domain: m.domain,
      domainLabel: m.domain ? (DOMAIN_LABEL[m.domain] ?? m.domain) : null,
      yearsExp: m.years_exp,
      offers: m.offers,
      openTo: m.open_to,
      reasons: m.reasons,
      route: route ? { chance: route.prob, between: route.path.length - 2 } : null,
    };
  });

  return ok({
    query: parsed.data.query,
    results,
    searched: replies.map(({ id, r }) => ({ node: id, ok: r.ok })),
    skippedOffline: [...graph.offlineNodes],
  });
}
