"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api, COLLEGE_COLOUR, readNames, useFedLive, useSession } from "@/lib/fed/client";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  name: string;
  city: string;
  tiles: { introsThisWeek: number; acceptancePct: number | null; medianResponseHours: number | null; hires: number };
  perDay: { label: string; count: number }[];
  topHelpers: { pid: string; role: string; grad_year: number | null; points: number; karz: number; score: number }[];
  residency: { peopleOnServer: number; identifyingFieldsToHub: number; hubAccess: boolean | null; reachable: boolean; namesReleased: number | null; topCompanies: { company: string; count: number }[] };
};
type Ev = { id: number; text: string; created_at: string; node_id: string | null };

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
      <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-6xl font-black leading-none tabular-nums">{value}</p>
      {sub && <p className="mt-2 text-base text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

/** Placement cell: engagement numbers, a live feed, top helpers, and what stays on the college's own server. */
export function CollegeView({ paramsPromise }: { paramsPromise: Promise<{ node: string }> }) {
  const { node } = use(paramsPromise);
  const { viewer } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<Ev[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await api<Stats & { error?: string }>(`/api/fed/college/${node}`);
    if (r.ok) setStats(r.data);
    else setError(r.data.error ?? "Could not load this college.");
    const { data } = await createClient().from("fed_events").select("id, text, created_at, node_id").neq("kind", "stage").order("id", { ascending: false }).limit(8);
    setEvents((data ?? []) as Ev[]);
  }, [node]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_intros", "fed_hops", "fed_ledger", "fed_events", "fed_nodes"], load);

  const helperKey = stats?.topHelpers.map((h) => h.pid).join(",") ?? "";
  const hasViewer = Object.keys(viewer).length > 0;
  useEffect(() => {
    if (!helperKey || !hasViewer) return;
    let alive = true;
    readNames(viewer, helperKey.split(",")).then((n) => alive && setNames(n));
    return () => {
      alive = false;
    };
  }, [helperKey, hasViewer, viewer]);

  if (error) return <p role="alert" className="rounded-xl bg-[var(--surface)] p-5 text-[var(--red)]">{error}</p>;
  if (!stats) return <div className="h-96 animate-pulse rounded-[22px] bg-[var(--surface)]" role="status" aria-label="Loading" />;

  const { tiles, residency } = stats;
  const max = Math.max(1, ...stats.perDay.map((d) => d.count));
  return (
    <div className="space-y-6">
      <header>
        <p className="text-base font-semibold uppercase tracking-wide" style={{ color: COLLEGE_COLOUR[node] }}>
          Placement cell · {stats.city}
        </p>
        <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">{stats.name}</h1>
      </header>

      <section aria-label="This week" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Intros this week" value={String(tiles.introsThisWeek)} />
        <Tile label="Hop acceptance" value={tiles.acceptancePct === null ? "—" : `${tiles.acceptancePct}%`} sub="of asked people said yes" />
        <Tile label="Median response" value={tiles.medianResponseHours === null ? "—" : `${tiles.medianResponseHours}h`} />
        <Tile label="Hires" value={String(tiles.hires)} sub="warm intros that ended in an offer" />
      </section>

      <section className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <h2 className="text-2xl font-black">Intros per day · last 14 days</h2>
        <svg viewBox="0 0 560 160" role="img" aria-label="Bar chart of intros per day" className="mt-4 h-auto w-full">
          {stats.perDay.map((d, i) => {
            const h = (d.count / max) * 110;
            return (
              <g key={i}>
                <rect x={i * 40 + 6} y={130 - h} width="28" height={h} rx="5" fill={COLLEGE_COLOUR[node]} className="transition-all duration-700" />
                <text x={i * 40 + 20} y={125 - h} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)">
                  {d.count || ""}
                </text>
                {i % 2 === 0 && (
                  <text x={i * 40 + 20} y="150" textAnchor="middle" fontSize="11" fill="var(--muted)">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <h2 className="text-2xl font-black">Live feed</h2>
          <ul className="mt-3 space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 text-lg">
                <span className="mt-2.5 size-2 shrink-0 rounded-full" style={{ background: COLLEGE_COLOUR[e.node_id ?? ""] ?? "var(--muted)" }} />
                {e.text}
              </li>
            ))}
            {events.length === 0 && <li className="text-[var(--muted)]">Quiet right now.</li>}
          </ul>
        </section>

        <section className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <h2 className="text-2xl font-black">Top helpers</h2>
          <ol className="mt-3 space-y-2">
            {stats.topHelpers.map((h, i) => (
              <li key={h.pid} className="flex items-center gap-3 text-lg">
                <span className="w-6 font-black text-[var(--muted)]">{i + 1}</span>
                <span className="flex-1 truncate font-semibold">{names[h.pid] ?? `${node.toUpperCase()} ${h.role}`}</span>
                <span className="font-black tabular-nums">{h.score}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="rounded-[22px] border-2 border-dashed border-[var(--ink)]/30 p-6" aria-label="Data residency">
        <h2 className="text-2xl font-black">Data residency</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-5xl font-black tabular-nums">{residency.reachable ? residency.peopleOnServer : "—"}</p>
            <p className="text-base text-[var(--muted)]">people on {node.toUpperCase()}’s own server</p>
          </div>
          <div>
            <p className="text-5xl font-black tabular-nums">{residency.identifyingFieldsToHub}</p>
            <p className="text-base text-[var(--muted)]">identifying fields shared with the hub</p>
          </div>
          <div>
            <p className="text-5xl font-black">{residency.hubAccess === null ? "OFFLINE" : residency.hubAccess ? "ON" : "OFF"}</p>
            <p className="text-base text-[var(--muted)]">hub access, controlled by the college</p>
          </div>
        </div>
      </section>
    </div>
  );
}
