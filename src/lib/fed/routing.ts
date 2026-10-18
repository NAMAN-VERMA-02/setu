import "server-only";
import { findRoutes, type Route } from "./bridge";
import { loadGraph, publicCard, type DirRow } from "./server";

export type RoutePlan =
  | { status: "ok"; best: Route; shortest: Route | null; nodes: ReturnType<typeof publicCard>[]; edges: { a: string; b: string; p: number }[] }
  | { status: "target_offline"; node: string }
  | { status: "no_route" };

/**
 * Plans the best route for `source` to reach `target`. `exclude` holds people who already declined
 * this intro; offline colleges are excluded automatically.
 */
export async function planRoute(source: string, target: string, exclude: Iterable<string> = []): Promise<RoutePlan> {
  const { edges, directory, offlinePids } = await loadGraph();
  const targetRow = directory.get(target);
  if (!targetRow) return { status: "no_route" };
  if (offlinePids.has(target)) return { status: "target_offline", node: targetRow.node_id };

  const { best, shortest } = findRoutes({ source, target, edges, exclude: [...offlinePids, ...exclude] });
  if (!best) return { status: "no_route" };

  const pids = new Set([...best.path, ...(shortest?.path ?? [])]);
  const drawn = [...best.hops, ...(shortest?.hops ?? [])];
  // two extra neighbours of the requester make the graph feel like a network, not a line
  for (const e of edges) {
    if (drawn.length >= best.hops.length + (shortest?.hops.length ?? 0) + 3) break;
    if ((e.a === source || e.b === source) && !pids.has(e.a === source ? e.b : e.a) && !offlinePids.has(e.a === source ? e.b : e.a)) {
      drawn.push({ a: e.a, b: e.b, p: e.p });
      pids.add(e.a === source ? e.b : e.a);
    }
  }
  const seen = new Set<string>();
  const uniq = drawn.filter((e) => {
    const k = [e.a, e.b].sort().join("|");
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const nodes = [...pids].map((p) => directory.get(p)).filter((d): d is DirRow => !!d).map(publicCard);
  return { status: "ok", best, shortest, nodes, edges: uniq };
}
