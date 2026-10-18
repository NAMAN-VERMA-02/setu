import { connection } from "next/server";
import { isNodeId } from "@/lib/fed/config";
import { nodeCall } from "@/lib/fed/nodes";
import { fail, getSession, ok } from "@/lib/fed/server";

type Step = { sem_or_year: number; label: string; cgpa_band: string | null; internship: boolean; decision: string | null; org: string | null };

/** A senior's then-to-now timeline, with CGPA as a band, never an exact figure. */
export async function GET(_req: Request, ctx: { params: Promise<{ pid: string }> }) {
  await connection();
  if (!(await getSession())) return fail("Pick a persona or join first.", 401);
  const { pid } = await ctx.params;
  const node = pid.split("_")[0];
  if (!isNodeId(node)) return fail("Unknown person.", 404);
  const r = await nodeCall<Step[]>(node, "GET", `/timeline/${encodeURIComponent(pid)}`);
  if (!r.ok) return fail(r.error === "revoked" ? `${node.toUpperCase()} is offline. Its people aren't ours to show.` : "That college server is not reachable right now.", 503);
  return ok({ steps: r.data });
}
