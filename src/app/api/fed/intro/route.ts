import { z } from "zod";
import { fedDb } from "@/lib/fed/db";
import { nodeCall } from "@/lib/fed/nodes";
import { fail, getSession, loadDirectory, ok } from "@/lib/fed/server";
import { planRoute } from "@/lib/fed/routing";
import { isNodeId } from "@/lib/fed/config";

const body = z.object({ target: z.string().min(3), trust_step: z.enum(["question", "call", "referral"]).default("question") });

/**
 * Sends an intro. The route is recomputed here (never trusted from the browser), the intro and its
 * hops are created in one transaction, and the requester's node is told who may see their name.
 * The ask text itself goes from the browser straight to the requester's own node.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("Pick a persona or join first.", 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick someone to reach.", 400);
  const { target, trust_step } = parsed.data;

  const plan = await planRoute(session.pid, target);
  if (plan.status !== "ok") return fail(plan.status === "target_offline" ? "That college is offline right now." : "No route to that person.", 409);

  const { data: intro, error } = await fedDb().rpc("fed_create_intro", {
    p_requester: session.pid,
    p_target: target,
    p_path: plan.best.path,
    p_prob: plan.best.prob,
    p_shortest: plan.shortest?.prob ?? plan.best.prob,
    p_trust: trust_step,
  });
  if (error || !intro) {
    const message = error?.message.includes("too_many_open_intros") ? "You already have 3 open intros. Wait for one to finish." : "We could not send that intro.";
    return fail(message, error?.message.includes("too_many") ? 429 : 500);
  }

  // Everyone on the path may read the requester's name, from the requester's own college node.
  if (isNodeId(session.node)) {
    await nodeCall(session.node, "POST", "/reveal", { pid: session.pid, viewer_pids: plan.best.path.slice(1) });
  }
  const dir = await loadDirectory();
  return ok({ intro_id: intro, path: plan.best.path, prob: plan.best.prob, shortest: plan.shortest?.prob ?? null, via: plan.best.path.slice(1, -1).map((p) => dir.get(p)?.role ?? "person") });
}
