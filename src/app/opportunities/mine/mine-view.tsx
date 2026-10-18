"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLive } from "@/lib/live/use-live";
import type { MineResponse } from "@/lib/opportunities/types";
import { OPP_LABELS, type OppKind } from "@/lib/validation/opportunities";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: MineResponse };

async function patch(url: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

export function MineView() {
  const [state, setState] = useState<State>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/opportunities/mine");
      const json = await res.json();
      setState(res.ok ? { status: "ok", data: json } : { status: "error", message: json.error ?? "Could not load your posts." });
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

  if (state.status === "loading") return <div className="h-40 animate-pulse rounded-[22px] bg-white" role="status" aria-label="Loading" />;
  if (state.status === "error") return <p role="alert" className="rounded-xl bg-white p-4 text-[var(--red)]">{state.message}</p>;

  const posts = state.data.opportunities;
  if (posts.length === 0) {
    return (
      <p className="rounded-[22px] bg-white p-6">
        You have not posted anything yet.{" "}
        <Link href="/opportunities/new" className="font-semibold underline">Post your first opportunity</Link>.
      </p>
    );
  }

  return (
    <ul className="space-y-6">
      {posts.map((p) => (
        <li key={p.id} className="rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{OPP_LABELS[p.kind as OppKind] ?? p.kind} · {p.status}</p>
              <h3 className="text-xl font-black uppercase leading-tight">{p.title}</h3>
            </div>
            {p.status === "open" && (
              <button type="button" onClick={async () => { if (await patch(`/api/opportunities/${p.id}`, { status: "closed" })) void refresh(); }} className="rounded-full border border-[var(--ink)] px-4 py-2 text-sm font-semibold">
                Close
              </button>
            )}
          </div>

          <h4 className="mt-4 text-sm font-bold uppercase tracking-wide">
            {p.applicants.length === 0 ? "No interest yet" : `${p.applicants.length} interested`}
          </h4>
          <ul className="mt-2 divide-y divide-[var(--ink)]/10">
            {p.applicants.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {a.person ? <Link href={`/people/${a.person.id}`} className="underline">{a.person.name}</Link> : "Someone"}
                    {a.person && <span className="ml-2 text-sm font-normal text-[var(--muted)]">{a.person.role} · {a.person.branch} · batch {a.person.batch}</span>}
                  </p>
                  {a.note && <p className="mt-1 text-sm">{a.note}</p>}
                  {a.reasons.length > 0 && <p className="mt-1 text-xs text-[var(--muted)]">{a.reasons.join(" · ")}</p>}
                </div>
                <div className="flex gap-2">
                  {a.status === "sent" && (
                    <button type="button" onClick={async () => { if (await patch(`/api/opportunities/interests/${a.id}`, { status: "seen" })) void refresh(); }} className="rounded-full border border-[var(--ink)] px-3 py-1 text-xs font-semibold">Mark seen</button>
                  )}
                  {a.status !== "shortlisted" ? (
                    <button type="button" onClick={async () => { if (await patch(`/api/opportunities/interests/${a.id}`, { status: "shortlisted" })) void refresh(); }} className="rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-semibold text-white">Shortlist</button>
                  ) : (
                    <span className="rounded-full bg-[var(--yellow)] px-3 py-1 text-xs font-bold">Shortlisted</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
