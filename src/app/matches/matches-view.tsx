"use client";

import { useEffect, useState } from "react";
import { MatchResults } from "@/components/matches/match-results";
import type { MatchResponse } from "@/lib/scoring/response";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: MatchResponse };

export function MatchesView({ semesters, initialSemester }: { semesters: number[]; initialSemester: number }) {
  const [semester, setSemester] = useState(initialSemester);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(`/api/match?semester=${semester}`, { signal: controller.signal });
        const json = await res.json();
        if (!res.ok) {
          setState({ status: "error", message: json.error ?? "Could not load your matches." });
          return;
        }
        setState({ status: "ok", data: json as MatchResponse });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setState({ status: "error", message: "Could not load your matches. Check your connection and try again." });
        }
      }
    })();
    return () => controller.abort();
  }, [semester]);

  return (
    <div>
      <div className="mb-6 max-w-xs">
        <label htmlFor="semester" className="mb-1 block text-sm font-medium">
          Match me at semester
        </label>
        <select
          id="semester"
          value={semester}
          onChange={(e) => setSemester(Number(e.target.value))}
          className="w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
        >
          {semesters.map((n) => (
            <option key={n} value={n}>
              Semester {n}
            </option>
          ))}
        </select>
      </div>

      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && (
          <div className="space-y-4" role="status" aria-label="Finding your matches">
            <div className="h-48 animate-pulse rounded-[22px] bg-white" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-40 animate-pulse rounded-[22px] bg-white" />
              <div className="h-40 animate-pulse rounded-[22px] bg-white" />
            </div>
          </div>
        )}
        {state.status === "error" && (
          <p role="alert" className="rounded-xl bg-white p-4 text-[var(--red)]">
            {state.message}
          </p>
        )}
        {state.status === "ok" && <MatchResults data={state.data} />}
      </div>
    </div>
  );
}
