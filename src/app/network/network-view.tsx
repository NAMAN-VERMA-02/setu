"use client";

import { useCallback, useEffect, useState } from "react";
import { NetworkBoard } from "@/components/network/network-board";
import { useLive } from "@/lib/live/use-live";
import type { ConnectionsResponse } from "@/lib/connections/types";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: ConnectionsResponse };

export function NetworkView() {
  const [state, setState] = useState<State>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/connections");
      const json = await res.json();
      setState(res.ok ? { status: "ok", data: json } : { status: "error", message: json.error ?? "Could not load your network." });
    } catch {
      setState({ status: "error", message: "Could not reach SETU. Check your connection and try again." });
    }
  }, []);

  useEffect(() => {
    // Fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useLive(refresh);

  async function act(id: string, action: "accept" | "decline" | "remove") {
    try {
      const res =
        action === "remove"
          ? await fetch(`/api/connections/${id}`, { method: "DELETE" })
          : await fetch(`/api/connections/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (res.ok) await refresh();
      return res.ok;
    } catch {
      return false;
    }
  }

  if (state.status === "loading") return <div className="h-80 animate-pulse rounded-[22px] bg-white" role="status" aria-label="Loading your network" />;
  if (state.status === "error") return <p role="alert" className="rounded-xl bg-white p-4 text-[var(--red)]">{state.message}</p>;
  return <NetworkBoard data={state.data} onAct={act} />;
}
