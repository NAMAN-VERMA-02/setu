"use client";

import { useState } from "react";
import type { ConnState } from "@/lib/connections/types";

/** Connect, accept or show the current state with one person. `demo` never calls the API. */
export function ConnectButton({ userId, initial, demo }: { userId: string; initial: ConnState; demo?: boolean }) {
  const [state, setState] = useState<ConnState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      if (demo) {
        setState(state === "pending_in" ? "connected" : "pending_out");
        return;
      }
      const res = await fetch("/api/connections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string; state?: ConnState };
      if (res.ok) setState(json.state ?? "pending_out");
      else setError(json.error ?? "Could not connect.");
    } catch {
      setError("Could not reach SETU. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "connected") return <span className="inline-block rounded-full bg-[var(--sage)] px-4 py-2 text-sm font-semibold">Connected ✓</span>;
  if (state === "pending_out") return <span className="inline-block rounded-full border border-[var(--ink)]/30 px-4 py-2 text-sm font-medium text-[var(--muted)]">Request sent</span>;

  return (
    <div>
      <button type="button" data-magnetic onClick={go} disabled={busy} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Sending…" : state === "pending_in" ? "Accept request" : "Connect"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--red)]">
          {error}
        </p>
      )}
    </div>
  );
}
