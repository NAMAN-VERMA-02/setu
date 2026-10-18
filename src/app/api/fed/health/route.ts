import { connection } from "next/server";
import { NODE_IDS, NODE_META } from "@/lib/fed/config";
import { nodeHealth, setStatus } from "@/lib/fed/nodes";
import { ensureNodes, ok } from "@/lib/fed/server";

/**
 * Pings every server and records its state. The open /live and /stage screens call this every few seconds, which is
 * the heartbeat (Vercel has no background worker). The state is written only when it changes: each write is
 * broadcast to every open screen, so writing on every ping makes screens refresh themselves in a loop.
 */
export async function GET() {
  await connection();
  await ensureNodes();
  const checks = await Promise.all(NODE_IDS.map(nodeHealth));
  await Promise.all(checks.map((c) => setStatus(c.node, !c.reachable ? "offline" : c.hubAccess ? "online" : "revoked", c.reachable ? c.ms : null, c.people)));
  return ok({
    nodes: checks.map((c) => ({
      id: c.node,
      name: NODE_META[c.node].name,
      city: NODE_META[c.node].city,
      status: !c.reachable ? "offline" : c.hubAccess ? "online" : "revoked",
      latencyMs: c.reachable ? c.ms : null,
      people: c.people,
    })),
    time: new Date().toISOString(),
  });
}
