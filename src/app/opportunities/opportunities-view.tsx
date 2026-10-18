"use client";

import { useEffect, useState } from "react";
import { OpportunityFeed } from "@/components/opportunities/opportunity-feed";
import { useLive } from "@/lib/live/use-live";
import type { FeedResponse, Result } from "@/lib/opportunities/types";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: FeedResponse };

async function sendInterest(id: string, note: string): Promise<Result> {
  try {
    const res = await fetch(`/api/opportunities/${id}/interest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (res.ok) return { ok: true };
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: json.error ?? "That did not work. Please try again." };
  } catch {
    return { ok: false, error: "Could not reach SETU. Check your connection and try again." };
  }
}

export function OpportunitiesView() {
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [state, setState] = useState<State>({ status: "loading" });
  const [tick, setTick] = useState(0); // bumps when a live change arrives, which refetches
  useLive(() => setTick((t) => t + 1));

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q), 250);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams();
        if (kind) params.set("kind", kind);
        if (debounced.trim()) params.set("q", debounced.trim());
        const res = await fetch(`/api/opportunities?${params}`, { signal: controller.signal });
        const json = await res.json();
        setState(res.ok ? { status: "ok", data: json } : { status: "error", message: json.error ?? "Could not load the board." });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState({ status: "error", message: "Could not reach SETU. Check your connection and try again." });
      }
    })();
    return () => controller.abort();
  }, [kind, debounced, tick]);

  if (state.status === "error") {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 text-[var(--red)]">
        {state.message}
      </p>
    );
  }

  return (
    <div aria-busy={state.status === "loading"}>
      <OpportunityFeed
        items={state.status === "ok" ? state.data.opportunities : []}
        canPost={state.status === "ok" ? state.data.canPost : false}
        kind={kind}
        q={q}
        onKind={setKind}
        onQuery={setQ}
        onInterest={sendInterest}
      />
    </div>
  );
}
