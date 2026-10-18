"use client";

import { useCallback, useEffect, useState } from "react";
import { RequestsBoard } from "@/components/requests/requests-board";
import { loadAsks, patchAsk } from "@/lib/asks/client";
import type { AsksResponse } from "@/lib/asks/types";
import { useLive } from "@/lib/live/use-live";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: AsksResponse };

export function RequestsView() {
  const [state, setState] = useState<State>({ status: "loading" });

  const refresh = useCallback(async () => {
    const { data, error } = await loadAsks();
    setState(data ? { status: "ok", data } : { status: "error", message: error ?? "Could not load your requests." });
  }, []);

  useEffect(() => {
    // Fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useLive(refresh);

  if (state.status === "loading") {
    return (
      <div className="space-y-4" role="status" aria-label="Loading your requests">
        <div className="h-40 animate-pulse rounded-[22px] bg-white" />
        <div className="h-40 animate-pulse rounded-[22px] bg-white" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 text-[var(--red)]">
        {state.message}
      </p>
    );
  }
  return <RequestsBoard data={state.data} onAction={patchAsk} onChanged={refresh} />;
}
