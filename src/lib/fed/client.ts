"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type NodeId = "ngit" | "rce" | "pro";
export type NodeState = { id: NodeId; name: string; city: string; status: "online" | "offline" | "revoked" | "unknown"; latencyMs: number | null; people: number };
export type SessionInfo = {
  pid: string;
  node: NodeId;
  role: string;
  label: string;
  storyKey: string | null;
  demoPersona: boolean;
  branch: string | null;
  gradYear: number | null;
};
export type ViewerTokens = Partial<Record<NodeId, { token: string; url: string }>>;

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { ...(init?.json ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    body: init?.json ? JSON.stringify(init.json) : init?.body,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/**
 * Re-runs `onChange` whenever one of the given tables changes. Uses Realtime and falls back to polling every
 * 3 seconds while the channel is not subscribed, so a tap on one screen shows on the others within ~1.5 s.
 */
export function useFedLive(tables: string[], onChange: () => void) {
  const saved = useRef(onChange);
  useEffect(() => {
    saved.current = onChange;
  });
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let subscribed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => saved.current(), 120);
    };
    let channel = supabase.channel(`fed-${Math.random().toString(36).slice(2)}`);
    for (const table of key.split(",")) channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, fire);
    channel.subscribe((status) => {
      subscribed = status === "SUBSCRIBED";
    });
    const poll = setInterval(() => {
      if (!subscribed) saved.current();
    }, 3000);
    return () => {
      clearInterval(poll);
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key]);
}

/** Node status for the header pills and cards; polls the hub heartbeat every `everyMs`. */
export function useNodeHealth(everyMs = 10000) {
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const refresh = useCallback(async () => {
    const r = await api<{ nodes: NodeState[] }>("/api/fed/health");
    if (r.ok) setNodes(r.data.nodes);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(refresh, everyMs);
    return () => clearInterval(id);
  }, [refresh, everyMs]);
  useFedLive(["fed_nodes"], refresh);
  return { nodes, refresh };
}

export function useSession() {
  const [state, setState] = useState<{ loading: boolean; session: SessionInfo | null; ledger: { points: number; karz: number; score: number }; viewer: ViewerTokens }>({
    loading: true,
    session: null,
    ledger: { points: 0, karz: 0, score: 0 },
    viewer: {},
  });
  const refresh = useCallback(async () => {
    const r = await api<{ session: SessionInfo | null; ledger?: { points: number; karz: number; score: number }; viewer?: ViewerTokens }>("/api/fed/session");
    setState({ loading: false, session: r.data.session ?? null, ledger: r.data.ledger ?? { points: 0, karz: 0, score: 0 }, viewer: r.data.viewer ?? {} });
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useFedLive(["fed_ledger"], refresh);
  return { ...state, refresh };
}

export type Card = { pid: string; name: string | null; headline?: string | null; masked?: boolean };

/**
 * Reads names straight from a college's own server with a viewer token. The hub never sees them.
 * Returns a map pid -> name; people the viewer may not see are simply missing.
 */
export async function readNames(viewer: ViewerTokens, pids: string[]): Promise<Record<string, string>> {
  const byNode = new Map<NodeId, string[]>();
  for (const pid of pids) {
    const node = pid.split("_")[0] as NodeId;
    byNode.set(node, [...(byNode.get(node) ?? []), pid]);
  }
  const out: Record<string, string> = {};
  await Promise.all(
    [...byNode.entries()].map(async ([node, list]) => {
      const v = viewer[node];
      if (!v) return;
      try {
        const res = await fetch(`${v.url}/public/cards`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-setu-viewer": v.token },
          body: JSON.stringify({ pids: list }),
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { cards?: Card[] } | Card[];
        const cards = Array.isArray(body) ? body : (body.cards ?? []);
        for (const c of cards) if (c.name && !c.masked) out[c.pid] = c.name;
      } catch {
        // an offline college simply shows no names
      }
    }),
  );
  return out;
}

export function useNames(viewer: ViewerTokens, pids: string[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = pids.slice().sort().join(",");
  const hasViewer = Object.keys(viewer).length > 0;
  const viewerRef = useRef(viewer);
  useEffect(() => {
    viewerRef.current = viewer;
  });
  useEffect(() => {
    if (!key || !hasViewer) return;
    let alive = true;
    readNames(viewerRef.current, key.split(",")).then((n) => alive && setNames(n));
    return () => {
      alive = false;
    };
  }, [key, hasViewer]);
  return names;
}

export const COLLEGE_COLOUR: Record<string, string> = { ngit: "#3b82f6", rce: "#f59e0b", pro: "#10b981" };

export function collegeOf(pid: string): NodeId {
  return pid.split("_")[0] as NodeId;
}
