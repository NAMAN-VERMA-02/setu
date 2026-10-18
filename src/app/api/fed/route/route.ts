import { connection } from "next/server";
import { fail, getSession, ok } from "@/lib/fed/server";
import { planRoute } from "@/lib/fed/routing";
import { NODE_META, isNodeId } from "@/lib/fed/config";

/** Best route (most likely to say yes) and the shortest route, with the small graph to draw. */
export async function GET(req: Request) {
  await connection();
  const session = await getSession();
  if (!session) return fail("Pick a persona or join first.", 401);
  const target = new URL(req.url).searchParams.get("target") ?? "";
  if (!target || target === session.pid) return fail("Pick someone to reach.", 400);

  const plan = await planRoute(session.pid, target);
  if (plan.status === "target_offline") {
    const name = isNodeId(plan.node) ? plan.node.toUpperCase() : plan.node;
    return ok({ status: "target_offline", message: `${name} is offline — its people aren't ours to show.`, college: isNodeId(plan.node) ? NODE_META[plan.node].name : plan.node });
  }
  if (plan.status === "no_route") return ok({ status: "no_route", message: "No route with up to 3 people in between. Try another person." });
  return ok({
    status: "ok",
    best: { path: plan.best.path, prob: plan.best.prob, hops: plan.best.hops },
    shortest: plan.shortest ? { path: plan.shortest.path, prob: plan.shortest.prob, hops: plan.shortest.hops } : null,
    nodes: plan.nodes,
    edges: plan.edges,
  });
}
