"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COLLEGE_COLOUR, readNames, useFedLive, useSession } from "@/lib/fed/client";
import { createClient } from "@/lib/supabase/client";

type Row = { pid: string; node_id: string; role: string; grad_year: number | null; points: number; karz: number; score: number };
const TABS = [
  { id: "all", label: "All" },
  { id: "ngit", label: "NGIT" },
  { id: "rce", label: "RCE" },
  { id: "pro", label: "Professionals" },
] as const;

const ROW_H = 76;

/** Rank = Points − Karz. Rows slide to their new place as the ledger changes. Names are served by each college's own server. */
export function LeaderboardView() {
  const { viewer, session } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [names, setNames] = useState<Record<string, string>>({});
  const viewerRef = useRef(viewer);
  useEffect(() => {
    viewerRef.current = viewer;
  });

  const load = useCallback(async () => {
    const { data } = await createClient().from("fed_leaderboard").select("*").order("score", { ascending: false }).limit(60);
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_ledger", "fed_directory"], load);

  const shown = useMemo(() => rows.filter((r) => tab === "all" || r.node_id === tab).slice(0, 12), [rows, tab]);
  const shownKey = shown.map((r) => r.pid).join(",");
  const hasViewer = Object.keys(viewer).length > 0;
  useEffect(() => {
    if (!shownKey || !hasViewer) return;
    let alive = true;
    readNames(viewerRef.current, shownKey.split(",")).then((n) => alive && setNames(n));
    return () => {
      alive = false;
    };
  }, [shownKey, hasViewer]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">Rank = Points − Karz · Points can’t be bought</p>
          <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">Who helps most.</h1>
        </div>
        <div role="tablist" aria-label="College" className="flex gap-2">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-full px-5 py-2 text-lg font-bold ${tab === t.id ? "bg-[var(--ink)] text-white" : "border border-[var(--ink)]/30"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="relative rounded-[22px] bg-[var(--surface)] p-3 shadow-[0_0_0_1px_rgba(15,15,14,.08)]" style={{ height: shown.length * ROW_H + 24 }}>
        {shown.map((r, i) => {
          const me = session?.pid === r.pid;
          return (
            <div
              key={r.pid}
              className={`absolute left-3 right-3 flex items-center gap-4 rounded-2xl px-4 transition-transform duration-700 ease-out ${me ? "bg-[var(--yellow)]/50" : ""}`}
              style={{ height: ROW_H - 8, transform: `translateY(${i * ROW_H + 8}px)` }}
            >
              <span className="w-10 text-3xl font-black tabular-nums text-[var(--muted)]">{i + 1}</span>
              <span className="size-3 shrink-0 rounded-full" style={{ background: COLLEGE_COLOUR[r.node_id] }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-bold">{names[r.pid] ?? `${r.node_id.toUpperCase()} member`}</span>
                <span className="block text-sm text-[var(--muted)]">
                  {r.node_id.toUpperCase()} {r.role === "alum" ? "alum" : r.role}
                  {r.grad_year ? ` ’${String(r.grad_year).slice(-2)}` : ""}
                </span>
              </span>
              <span className="hidden w-24 text-right text-lg tabular-nums sm:block">
                <span className="block font-bold text-[#15803d]">+{r.points}</span>
                <span className="block text-sm text-[var(--muted)]">Points</span>
              </span>
              <span className="hidden w-24 text-right text-lg tabular-nums sm:block">
                <span className="block font-bold text-[#b91c1c]">−{r.karz}</span>
                <span className="block text-sm text-[var(--muted)]">Karz</span>
              </span>
              <span className="w-28 text-right text-4xl font-black tabular-nums">{r.score}</span>
            </div>
          );
        })}
        {shown.length === 0 && <p className="p-6 text-[var(--muted)]">No one yet.</p>}
      </div>
      <p className="text-base text-[var(--muted)]">Names are served by each college’s own server, only for people who chose to be on the leaderboard.</p>
    </div>
  );
}
