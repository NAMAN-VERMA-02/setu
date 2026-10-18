import "server-only";
import { nodeConfig, type NodeId } from "./config";
import { fedDb } from "./db";

export type NodeReply<T> =
  | { ok: true; data: T; ms: number; identifyingFields: number }
  | { ok: false; error: "not_configured" | "offline" | "revoked" | "bad_response"; status?: number; ms: number };

const TIMEOUT_MS = 2000;

async function audit(node: NodeId, call: string, ms: number, identifyingFields: number, note?: string) {
  try {
    await fedDb().from("fed_audit").insert({ node_id: node, call, identifying_fields: identifyingFields, ms, note: note ?? null });
  } catch {
    // auditing must never break a request
  }
}

/**
 * Records a server's state, but only when it CHANGED (or once a minute). Every write to fed_nodes is broadcast to all
 * open screens over Realtime; writing on every call made the Find and Mirror screens refresh themselves in a loop.
 */
const lastWritten = new Map<string, { status: string; people: number | undefined; at: number }>();
const KEEP_FRESH_MS = 60_000;

export async function setStatus(node: NodeId, status: "online" | "offline" | "revoked", ms: number | null, people?: number) {
  const last = lastWritten.get(node);
  const now = Date.now();
  const same = last && last.status === status && (people === undefined || last.people === people);
  if (same && now - last.at < KEEP_FRESH_MS) return;
  lastWritten.set(node, { status, people: people ?? last?.people, at: now });
  try {
    await fedDb()
      .from("fed_nodes")
      .update({
        status,
        latency_ms: ms,
        ...(people !== undefined ? { people_count: people } : {}),
        ...(status === "online" ? { last_seen: new Date(now).toISOString() } : {}),
      })
      .eq("id", node);
  } catch {
    // status is advisory
  }
}

/**
 * Hub -> node call: Bearer token, 2 s timeout, one retry on network errors.
 * Every call is written to fed_audit with the node's own count of identifying fields in the reply.
 */
export async function nodeCall<T>(
  node: NodeId,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  opts: { timeoutMs?: number; retries?: number; quiet?: boolean } = {},
): Promise<NodeReply<T>> {
  const cfg = nodeConfig(node);
  if (!cfg) return { ok: false, error: "not_configured", ms: 0 };
  const attempts = 1 + (opts.retries ?? 1);
  const started = Date.now();

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${cfg.baseUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${cfg.hubToken}`, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
        cache: "no-store",
      });
      const ms = Date.now() - started;
      const idf = Number(res.headers.get("x-setu-identifying-fields") ?? 0);

      if (res.status === 503) {
        await setStatus(node, "revoked", ms);
        if (!opts.quiet) await audit(node, `${method} ${path}`, ms, 0, "hub access revoked by the college");
        return { ok: false, error: "revoked", status: 503, ms };
      }
      if (!res.ok) return { ok: false, error: "bad_response", status: res.status, ms };

      const data = (await res.json()) as T;
      await setStatus(node, "online", ms);
      if (!opts.quiet) await audit(node, `${method} ${path}`, ms, idf);
      return { ok: true, data, ms, identifyingFields: idf };
    } catch {
      // network error or timeout: retry once, then mark the node offline
    }
  }
  const ms = Date.now() - started;
  await setStatus(node, "offline", null);
  return { ok: false, error: "offline", ms };
}

/** GET /health is public (and works even when hub access is off), so it uses no token. */
export async function nodeHealth(node: NodeId): Promise<{
  node: NodeId;
  reachable: boolean;
  hubAccess: boolean;
  people: number;
  ms: number;
}> {
  const cfg = nodeConfig(node);
  if (!cfg) return { node, reachable: false, hubAccess: false, people: 0, ms: 0 };
  const started = Date.now();
  try {
    const res = await fetch(`${cfg.baseUrl}/health`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    const ms = Date.now() - started;
    if (!res.ok) return { node, reachable: false, hubAccess: false, people: 0, ms };
    const h = (await res.json()) as { people?: number; hub_access?: string | boolean };
    const hubAccess = h.hub_access === true || h.hub_access === "on";
    return { node, reachable: true, hubAccess, people: h.people ?? 0, ms };
  } catch {
    return { node, reachable: false, hubAccess: false, people: 0, ms: Date.now() - started };
  }
}
