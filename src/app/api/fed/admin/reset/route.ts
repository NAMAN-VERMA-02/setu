import { NODE_IDS, nodeConfig, type NodeId } from "@/lib/fed/config";
import { fedDb } from "@/lib/fed/db";
import { nodeCall } from "@/lib/fed/nodes";
import { ensureNodes, fail, isStage, ok } from "@/lib/fed/server";
import { colleagueEdges } from "@/lib/fed/seed/colleagues";
import { STORY_CROSS_EDGES } from "@/lib/fed/seed/cross-edges";
import { buildHistory } from "@/lib/fed/seed/history";
import { buildOpportunities } from "@/lib/fed/seed/opportunities";

type NodeDir = {
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
type NodeEdge = { a: string; b: string; prior: number };

async function insertChunks(table: string, rows: object[], size = 400, onConflict?: string) {
  const db = fedDb();
  for (let i = 0; i < rows.length; i += size) {
    const q = db.from(table);
    const { error } = onConflict ? await q.upsert(rows.slice(i, i + size), { onConflict, ignoreDuplicates: true }) : await q.insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/** Resets the whole demo in a few seconds: nodes, hub tables, story edges, history, opportunities. Presenter only. */
export async function POST(req: Request) {
  if (!isStage(req)) return fail("Presenter only.", 403);
  try {
    return await reset();
  } catch (e) {
    // say what went wrong instead of an empty 500, so the presenter (or a rehearsal script) can act on it
    return fail(`Reset failed: ${e instanceof Error ? e.message : "unknown error"}`, 500);
  }
}

async function reset() {
  const started = Date.now();
  const db = fedDb();
  await ensureNodes();

  // 1. nodes re-seed themselves (and switch hub access back on)
  const configured = NODE_IDS.filter((id) => nodeConfig(id));
  const resets = await Promise.all(configured.map((id) => nodeCall(id, "POST", "/admin/reset", {}, { timeoutMs: 8000, retries: 0, quiet: true })));
  const offline = configured.filter((_, i) => !resets[i].ok);

  // 2. pull the pseudonymous directory and the intra-college edges from every node that is up.
  // This happens BEFORE the hub is cleared, so a node that does not answer never leaves the hub empty.
  const dirRows: (NodeDir & { node_id: NodeId })[] = [];
  const edgeRows: NodeEdge[] = [];
  await Promise.all(
    configured.map(async (id) => {
      const [d, e] = await Promise.all([nodeCall<NodeDir[]>(id, "GET", "/directory", undefined, { quiet: true }), nodeCall<NodeEdge[]>(id, "GET", "/edges", undefined, { quiet: true })]);
      if (d.ok) dirRows.push(...d.data.map((r) => ({ ...r, node_id: id })));
      if (e.ok) edgeRows.push(...e.data);
    }),
  );
  if (!dirRows.length) return fail("No college server answered. Warm them up and try again.", 503, { offline });
  if (dirRows.length < 20) return fail("A college server returned too few people. Warm them up and try again.", 503, { offline });

  // 3. clear the hub (children first), then refill it
  const wipe = async (table: string, col: string, op: "neq" | "gt", value: string | number) => {
    const q = db.from(table).delete();
    const { error } = op === "neq" ? await q.neq(col, value as string) : await q.gt(col, value as number);
    if (error) throw new Error(`${table}: ${error.message}`);
  };
  await wipe("fed_hops", "idx", "gt", -1);
  await wipe("fed_intros", "requester", "neq", "");
  await wipe("fed_payforward", "status", "neq", "");
  await wipe("fed_vouches", "from_pid", "neq", "");
  await wipe("fed_opportunities", "title", "neq", "\u0000");
  await wipe("fed_ledger", "id", "gt", 0);
  await wipe("fed_events", "id", "gt", 0);
  await wipe("fed_audit", "id", "gt", 0);
  await wipe("fed_edges", "a", "neq", "");
  await wipe("fed_directory", "pid", "neq", "");
  await insertChunks("fed_directory", dirRows);

  const pidByStory = new Map(dirRows.filter((r) => r.story_key).map((r) => [r.story_key as string, r.pid]));
  const known = new Set(dirRows.map((r) => r.pid));
  const cross = STORY_CROSS_EDGES.flatMap((e) => {
    const a = pidByStory.get(e.a);
    const b = pidByStory.get(e.b);
    return a && b ? [{ a, b, prior: e.prior }, { a: b, b: a, prior: e.prior }] : [];
  });
  const colleagues = colleagueEdges(dirRows);
  const edges = [...edgeRows, ...cross, ...colleagues].filter((e) => known.has(e.a) && known.has(e.b));
  await insertChunks("fed_edges", edges, 400, "a,b");

  // 4. history and ledger
  const history = buildHistory(dirRows.map((r) => ({ pid: r.pid, node_id: r.node_id, role: r.role, story_key: r.story_key })), new Date());
  await insertChunks("fed_intros", history.intros);
  await insertChunks("fed_hops", history.hops);
  await insertChunks("fed_ledger", history.ledger);

  // 5. opportunities
  const opportunities = buildOpportunities(dirRows);
  if (opportunities.length) await insertChunks("fed_opportunities", opportunities);

  await db.rpc("fed_event", { p_kind: "reset", p_text: "Demo reset: two college servers connected", p_node: null, p_intro: null });
  return ok({
    ok: true,
    ms: Date.now() - started,
    people: dirRows.length,
    edges: edges.length,
    historyIntros: history.intros.length,
    nodesOffline: offline,
  });
}
