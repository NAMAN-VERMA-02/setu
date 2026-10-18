import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { BridgeEdge } from "./bridge";
import { configuredNodes, NODE_META, nodeConfig, secret, type NodeId, NODE_IDS } from "./config";
import { fedDb } from "./db";
import { DOMAIN_LABEL } from "./taxonomy";
import { mintViewerToken, SESSION_COOKIE, signSession, verifySession, type FedSession } from "./tokens";

export type DirRow = {
  pid: string;
  node_id: NodeId;
  story_key: string | null;
  role: string;
  branch_code: string | null;
  grad_year: number | null;
  public_title: string | null;
  public_company: string | null;
  open_to_intros: boolean;
  on_leaderboard: boolean;
};

export const noStore = { "cache-control": "no-store" } as const;

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

export function fail(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: noStore });
}

export async function getSession(): Promise<FedSession | null> {
  const jar = await cookies();
  return verifySession(secret("HUB_SESSION_SECRET"), jar.get(SESSION_COOKIE)?.value);
}

export async function setSession(s: FedSession) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(secret("HUB_SESSION_SECRET"), s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

/** The presenter's control key: header `x-stage-key` or `?key=`. */
export function isStage(req: Request): boolean {
  const expected = process.env.DEMO_STAGE_KEY;
  if (!expected) return false;
  const given = req.headers.get("x-stage-key") ?? new URL(req.url).searchParams.get("key");
  return given === expected;
}

/** Makes sure both college rows exist (name, city, urls) so status updates have something to update. */
let nodesEnsured = false;
export async function ensureNodes() {
  // once per server instance: an upsert is a write, and every write is broadcast to every open screen
  if (nodesEnsured) return;
  nodesEnsured = true;
  const rows = configuredNodes().map((n) => ({
    id: n.id,
    name: NODE_META[n.id].name,
    city: NODE_META[n.id].city,
    base_url: process.env[`NEXT_PUBLIC_NODE_${n.id.toUpperCase()}_URL`] ?? n.baseUrl,
    mcp_url: n.mcpUrl,
  }));
  if (rows.length) await fedDb().from("fed_nodes").upsert(rows, { onConflict: "id" });
}

export async function offlineNodeIds(): Promise<Set<NodeId>> {
  const { data } = await fedDb().from("fed_nodes").select("id, status");
  const offline = new Set<NodeId>();
  for (const id of NODE_IDS) {
    const row = data?.find((r) => r.id === id);
    // a college that is not configured or is not online is treated as offline for routing
    if (!row || row.status === "offline" || row.status === "revoked") offline.add(id);
  }
  return offline;
}

export async function loadDirectory(): Promise<Map<string, DirRow>> {
  const { data } = await fedDb().from("fed_directory").select("*").limit(5000);
  return new Map((data ?? []).map((r) => [r.pid as string, r as DirRow]));
}

export async function loadGraph(): Promise<{ edges: BridgeEdge[]; directory: Map<string, DirRow>; offlineNodes: Set<NodeId>; offlinePids: Set<string> }> {
  const [directory, offlineNodes, { data }] = await Promise.all([
    loadDirectory(),
    offlineNodeIds(),
    fedDb().from("fed_graph").select("a, b, p").limit(10000),
  ]);
  const offlinePids = new Set([...directory.values()].filter((d) => offlineNodes.has(d.node_id)).map((d) => d.pid));
  return { edges: (data ?? []).map((e) => ({ a: e.a as string, b: e.b as string, p: e.p as number })), directory, offlineNodes, offlinePids };
}

/** What a person is allowed to see about someone on the hub: role words only, never a name. */
export function publicCard(d: DirRow) {
  return {
    pid: d.pid,
    node: d.node_id,
    role: d.role,
    branch: d.branch_code,
    gradYear: d.grad_year,
    title: d.public_title,
    company: d.public_company,
    label: cardLabel(d),
  };
}

export function cardLabel(d: Pick<DirRow, "node_id" | "role" | "grad_year" | "public_title" | "public_company"> & { branch_code?: string | null }): string {
  // a professional is described by the field they work in; a college person by college, role and year
  const who =
    d.role === "professional"
      ? `${DOMAIN_LABEL[d.branch_code ?? ""] ?? "Professional"} professional`
      : `${d.node_id.toUpperCase()} ${d.role === "alum" ? "alum" : d.role}${d.grad_year ? ` ’${String(d.grad_year).slice(-2)}` : ""}`;
  const what = [d.public_title, d.public_company].filter(Boolean).join(", ");
  return what ? `${who} · ${what}` : who;
}

/** One viewer token per college, for the given person. The browser uses them to read names straight from a node. */
export function viewerTokensFor(pid: string): Partial<Record<NodeId, { token: string; url: string }>> {
  const out: Partial<Record<NodeId, { token: string; url: string }>> = {};
  for (const id of NODE_IDS) {
    const cfg = nodeConfig(id);
    if (!cfg) continue;
    out[id] = {
      token: mintViewerToken(cfg.viewerSecret, pid),
      url: process.env[`NEXT_PUBLIC_NODE_${id.toUpperCase()}_URL`] ?? cfg.baseUrl,
    };
  }
  return out;
}

export function isStoryPersona(d: DirRow | undefined): boolean {
  return !!d?.story_key;
}
