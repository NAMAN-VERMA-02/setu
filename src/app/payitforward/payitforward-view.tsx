"use client";

import { useCallback, useEffect, useState } from "react";
import { PayForwardBoard, type PayForwardHandlers, type Result } from "@/components/payitforward/pay-forward-board";
import { useLive } from "@/lib/live/use-live";
import type { PayItForwardResponse } from "@/lib/validation/payforward";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: PayItForwardResponse };

const NETWORK = "Could not reach SETU. Check your connection and try again.";

async function post(url: string, body: Record<string, unknown>): Promise<Result> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return { ok: true };
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: json.error ?? "That did not work. Please try again." };
  } catch {
    return { ok: false, error: NETWORK };
  }
}

export function PayItForwardView() {
  const [state, setState] = useState<State>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/payitforward");
      const json = await res.json();
      setState(res.ok ? { status: "ok", data: json } : { status: "error", message: json.error ?? "Could not load this page." });
    } catch {
      setState({ status: "error", message: NETWORK });
    }
  }, []);

  useEffect(() => {
    // Fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);
  useLive(refresh);

  if (state.status === "loading") {
    return <div className="h-56 animate-pulse rounded-[22px] bg-white" role="status" aria-label="Loading" />;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="rounded-xl bg-white p-4 text-[var(--red)]">
        {state.message}
      </p>
    );
  }

  const handlers: PayForwardHandlers = {
    reportSuccess: (company) => post("/api/payitforward/success", { company }),
    answer: (juniorId, answer) => post("/api/payitforward/answer", { juniorId, answer }),
    onChanged: refresh,
  };
  return <PayForwardBoard data={state.data} handlers={handlers} />;
}
