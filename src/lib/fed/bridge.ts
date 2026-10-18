/**
 * Bridge: the route most likely to say yes.
 * Each hop has a probability p; a chain succeeds with the product of its hops, so the best chain
 * minimises the sum of -ln(p). Search is hop-limited (at most 3 people in between) and compared
 * against the plain fewest-hops route.
 */

export type BridgeEdge = { a: string; b: string; p: number };
export type Hop = { a: string; b: string; p: number };
export type Route = { path: string[]; prob: number; hops: Hop[] };
export type BridgeResult = { best: Route | null; shortest: Route | null };

export const MAX_INTERMEDIARIES = 3;

type Options = {
  source: string;
  target: string;
  edges: BridgeEdge[];
  /** People who must not be used (declined, offline college, etc). The source is never excluded. */
  exclude?: Iterable<string>;
  maxIntermediaries?: number;
};

type Cell = { cost: number; prev: string | null };

export function findRoutes({ source, target, edges, exclude = [], maxIntermediaries = MAX_INTERMEDIARIES }: Options): BridgeResult {
  const blocked = new Set(exclude);
  blocked.delete(source);
  if (source === target || blocked.has(target)) return { best: null, shortest: null };

  const adj = new Map<string, { to: string; p: number }[]>();
  const link = (from: string, to: string, p: number) => {
    if (blocked.has(from) || blocked.has(to) || p <= 0 || p >= 1.0000001) return;
    const list = adj.get(from) ?? [];
    // keep the strongest of any parallel edges
    const existing = list.find((x) => x.to === to);
    if (existing) existing.p = Math.max(existing.p, p);
    else list.push({ to, p });
    adj.set(from, list);
  };
  for (const e of edges) {
    link(e.a, e.b, e.p);
    link(e.b, e.a, e.p);
  }

  // layers[k] = cheapest way to reach each person using exactly k edges
  const maxEdges = maxIntermediaries + 1;
  const layers: Map<string, Cell>[] = [new Map([[source, { cost: 0, prev: null }]])];
  for (let k = 1; k <= maxEdges; k++) {
    const next = new Map<string, Cell>();
    for (const [node, cell] of layers[k - 1]) {
      if (node === target) continue; // a path ends when it reaches the target
      for (const { to, p } of adj.get(node) ?? []) {
        if (to === source) continue;
        const cost = cell.cost - Math.log(p);
        const have = next.get(to);
        if (!have || cost < have.cost - 1e-12) next.set(to, { cost, prev: node });
      }
    }
    layers.push(next);
  }

  const build = (k: number): Route | null => {
    const end = layers[k]?.get(target);
    if (!end) return null;
    const path = [target];
    let node = target;
    for (let i = k; i > 0; i--) {
      const prev = layers[i].get(node)!.prev!;
      path.unshift(prev);
      node = prev;
    }
    if (new Set(path).size !== path.length) return null; // never loop back through someone
    const hops: Hop[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const p = adj.get(path[i])!.find((x) => x.to === path[i + 1])!.p;
      hops.push({ a: path[i], b: path[i + 1], p });
    }
    return { path, prob: hops.reduce((m, h) => m * h.p, 1), hops };
  };

  let best: Route | null = null;
  let shortest: Route | null = null;
  for (let k = 1; k <= maxEdges; k++) {
    const route = build(k);
    if (!route) continue;
    if (!best || route.prob > best.prob + 1e-12) best = route;
    if (!shortest) shortest = route; // fewest hops; one best route per length already
  }
  return { best, shortest };
}

/** Everything within `radius` edges of the given people, for drawing a small graph. */
export function neighbourhood(edges: BridgeEdge[], centres: string[], radius = 1): BridgeEdge[] {
  const seen = new Set(centres);
  let frontier = new Set(centres);
  const kept: BridgeEdge[] = [];
  for (let r = 0; r < radius; r++) {
    const nextFrontier = new Set<string>();
    for (const e of edges) {
      if (frontier.has(e.a) || frontier.has(e.b)) {
        kept.push(e);
        for (const n of [e.a, e.b]) {
          if (seen.has(n)) continue;
          seen.add(n);
          nextFrontier.add(n);
        }
      }
    }
    frontier = nextFrontier;
  }
  return kept;
}
