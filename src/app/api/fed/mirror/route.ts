import { connection } from "next/server";
import { NODE_IDS } from "@/lib/fed/config";
import { nodeCall } from "@/lib/fed/nodes";
import { fail, getSession, loadDirectory, ok, offlineNodeIds, cardLabel } from "@/lib/fed/server";

type Vector = { vector: number[]; sem: number; branch: string; goal_tag: string };
type Match = {
  pid: string;
  score: number;
  shared_trait: string;
  rarity_pct: number;
  then_label: string;
  now_title: string | null;
  now_company: string | null;
  outcome: string | null;
};

/**
 * Mirror: people who were exactly where you are. The vector is computed on your own college's node
 * and sent (in transit only, never stored) to every online node, which returns matches without names.
 */
export async function GET() {
  await connection();
  const session = await getSession();
  if (!session) return fail("Pick a persona or join first.", 401);

  const own = await nodeCall<Vector>(session.node as (typeof NODE_IDS)[number], "POST", "/vector", { pid: session.pid });
  // Mirror compares a student with seniors at the same semester. Alumni and professionals have no current semester:
  // they use Find instead.
  if (!own.ok && own.error === "bad_response" && own.status === 404) {
    return ok({ matches: [], sem: 0, nodes: [], skippedOffline: [], notStudent: true });
  }
  if (!own.ok) return fail(own.error === "revoked" ? "Your college has disconnected from Setu." : "Your server is not reachable right now.", 503);

  const offline = await offlineNodeIds();
  const targets = NODE_IDS.filter((id) => !offline.has(id) || id === session.node);
  const results = await Promise.all(
    targets.map(async (id) => {
      const r = await nodeCall<Match[]>(id, "POST", "/mirror", {
        vector: own.data.vector,
        sem: own.data.sem,
        requester_node: session.node,
        branch: own.data.branch,
        goal_tag: own.data.goal_tag,
        limit: 8,
      });
      return { id, r };
    }),
  );

  const dir = await loadDirectory();
  const ranked = results
    .flatMap(({ id, r }) => (r.ok ? r.data.map((m) => ({ ...m, node: id })) : []))
    .filter((m) => m.pid !== session.pid)
    .sort((a, b) => b.score - a.score);
  // "People who were where you are" means a real match (70%+). If a profile is unusual and fewer than
  // three qualify, show the closest five instead of an empty screen.
  const strong = ranked.filter((m) => m.score >= 0.7);
  const matches = (strong.length >= 3 ? strong : ranked.slice(0, 5))
    .slice(0, 12)
    .map((m) => {
      const d = dir.get(m.pid);
      return {
        pid: m.pid,
        node: m.node,
        score: m.score,
        percent: Math.round(m.score * 100),
        sharedTrait: m.shared_trait,
        rarityPct: m.rarity_pct,
        thenLabel: m.then_label,
        nowTitle: m.now_title,
        nowCompany: m.now_company,
        outcome: m.outcome,
        label: d ? cardLabel(d) : `${m.node.toUpperCase()} alum`,
        gradYear: d?.grad_year ?? null,
      };
    });

  return ok({
    matches,
    sem: own.data.sem,
    nodes: results.map(({ id, r }) => ({ id, ok: r.ok })),
    skippedOffline: [...offline],
  });
}
