import { z } from "zod";
import { isNodeId, type NodeId } from "@/lib/fed/config";
import { fedDb } from "@/lib/fed/db";
import { nodeCall } from "@/lib/fed/nodes";
import { fail, ok, setSession } from "@/lib/fed/server";

const body = z.object({ pid: z.string().regex(/^[a-z]+_[0-9a-f]{12}$/), node: z.string() });

type NodeEntry = {
  pid: string;
  story_key: string | null;
  role: string;
  branch_code: string | null;
  grad_year: number | null;
  public_title: string | null;
  public_company: string | null;
  open_to_intros: boolean;
  on_leaderboard: boolean;
};

/**
 * A judge just created a profile on a college node. The hub learns only the pseudonymous id and the
 * public card, which it pulls from the node itself rather than trusting the browser.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isNodeId(parsed.data.node)) return fail("That registration is not valid.", 400);
  const { pid } = parsed.data;
  const node: NodeId = parsed.data.node;
  if (!pid.startsWith(`${node}_`)) return fail("That registration is not valid.", 400);

  const reply = await nodeCall<NodeEntry[]>(node, "GET", `/directory?pid=${encodeURIComponent(pid)}`);
  if (!reply.ok) return fail("That college server is not reachable right now.", 503);
  const entry = reply.data.find((e) => e.pid === pid);
  if (!entry) return fail("We could not find that profile on the college server.", 404);

  const db = fedDb();
  await db.from("fed_directory").upsert(
    {
      pid,
      node_id: node,
      story_key: null,
      role: entry.role,
      branch_code: entry.branch_code,
      grad_year: entry.grad_year,
      public_title: entry.public_title,
      public_company: entry.public_company,
      open_to_intros: entry.open_to_intros,
      on_leaderboard: entry.on_leaderboard,
    },
    { onConflict: "pid" },
  );

  // Two edges to generated people at the same college, never to story people.
  const { data: peers } = await db
    .from("fed_directory")
    .select("pid, role")
    .eq("node_id", node)
    .is("story_key", null)
    .neq("pid", pid)
    .neq("role", "placement")
    .limit(60);
  const pool = (peers ?? []).filter((p) => p.role === "alum" || p.role === "student" || p.role === "professional");
  const picks = pool.sort((a, b) => hash(pid + a.pid) - hash(pid + b.pid)).slice(0, 2);
  if (picks.length) {
    await db.from("fed_edges").upsert(
      picks.flatMap((p) => [
        { a: pid, b: p.pid, prior: 0.5 },
        { a: p.pid, b: pid, prior: 0.5 },
      ]),
      { onConflict: "a,b", ignoreDuplicates: true },
    );
  }

  await db.from("fed_audit").insert({ node_id: node, call: "register", identifying_fields: 0, note: "received 1 pseudonymous ID, 0 identifying fields" });
  await db.rpc("fed_event", { p_kind: "join", p_text: `A new ${entry.role} joined from ${node.toUpperCase()}`, p_node: node, p_intro: null });
  await setSession({ pid, node });
  return ok({ ok: true, pid });
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
