"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NeedSession } from "@/components/live/need-session";
import { api, COLLEGE_COLOUR, useFedLive } from "@/lib/fed/client";

type Match = {
  pid: string;
  node: string;
  percent: number;
  sharedTrait: string;
  rarityPct: number;
  thenLabel: string;
  nowTitle: string | null;
  nowCompany: string | null;
  outcome: string | null;
  label: string;
};
type Step = { sem_or_year: number; label: string; cgpa_band: string | null; internship: boolean; decision: string | null; org: string | null };
type MirrorResponse = { matches: Match[]; sem: number; nodes: { id: string; ok: boolean }[]; skippedOffline: string[]; notStudent?: boolean };

function Timeline({ pid }: { pid: string }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    api<{ steps?: Step[]; error?: string }>(`/api/fed/timeline/${pid}`).then((r) => {
      if (!alive) return;
      if (r.ok && r.data.steps) setSteps(r.data.steps);
      else setErr(r.data.error ?? "Could not load the timeline.");
    });
    return () => {
      alive = false;
    };
  }, [pid]);
  if (err) return <p className="text-[var(--red)]">{err}</p>;
  if (!steps) return <div className="h-16 animate-pulse rounded-xl bg-[var(--paper)]" />;
  return (
    <ol className="mt-4 space-y-3 border-l-2 border-[var(--ink)]/20 pl-5">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[27px] top-1.5 size-3 rounded-full bg-[var(--ink)]" />
          <p className="font-bold">
            {s.sem_or_year <= 8 ? `Semester ${s.sem_or_year}` : s.sem_or_year}
            <span className="ml-2 font-normal text-[var(--muted)]">{s.label}</span>
          </p>
          <p className="text-base text-[var(--muted)]">
            {[s.cgpa_band && `CGPA ${s.cgpa_band}`, s.internship && "internship", s.org].filter(Boolean).join(" · ")}
          </p>
        </li>
      ))}
    </ol>
  );
}

function MirrorBody() {
  const [data, setData] = useState<MirrorResponse | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<MirrorResponse & { error?: string }>("/api/fed/mirror");
    if (r.ok) {
      setData(r.data);
      setError("");
    } else setError(r.data.error ?? "Could not load your Mirror.");
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  // a college going offline or coming back changes who can be shown
  useFedLive(["fed_nodes"], load);

  if (error) return <p role="alert" className="rounded-xl bg-[var(--surface)] p-5 text-[var(--red)]">{error}</p>;
  if (!data) return <div className="h-72 animate-pulse rounded-[22px] bg-[var(--surface)]" role="status" aria-label="Finding people like you" />;
  if (data.notStudent) {
    return (
      <div className="rounded-[22px] bg-[var(--surface)] p-8 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <h1 className="text-4xl font-black uppercase leading-tight">Mirror is for students.</h1>
        <p className="mt-3 max-w-2xl text-xl text-[var(--muted)]">It shows seniors who were where you are now. You are already past that stage, so use Find: say who you need, in any profession, and Setu shows the warmest way in.</p>
        <Link href="/live/find" className="mt-6 inline-block rounded-full bg-[var(--ink)] px-8 py-3 text-xl font-bold text-white">
          Find someone
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">Mirror · semester {data.sem}</p>
        <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
          <span className="tabular-nums">{data.matches.length}</span> people were where you are.
        </h1>
        {data.skippedOffline.length > 0 && (
          <p className="mt-3 rounded-xl bg-[var(--red-tile)]/20 p-3 text-base font-semibold">
            {data.skippedOffline.map((n) => n.toUpperCase()).join(", ")} is offline — its people aren’t ours to show.
          </p>
        )}
      </header>

      <ul className="grid gap-5 lg:grid-cols-2">
        {data.matches.map((m) => (
          <li key={m.pid} className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]" style={{ borderLeft: `6px solid ${COLLEGE_COLOUR[m.node]}` }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-black leading-snug">{m.label}</p>
                <p className="mt-1 text-base text-[var(--muted)]">Name hidden. Setu doesn’t know it — {m.node.toUpperCase()}’s server does.</p>
              </div>
              <p className="shrink-0 text-5xl font-black leading-none tabular-nums" aria-label={`${m.percent} percent match`}>
                {m.percent}
                <span className="text-2xl">%</span>
              </p>
            </div>
            <p className="mt-4 rounded-xl bg-[var(--yellow)]/50 p-3 text-lg font-semibold">{m.sharedTrait}</p>
            <p className="mt-3 text-base text-[var(--muted)]">
              Then: {m.thenLabel} <span aria-hidden="true">→</span> Now: <strong className="text-[var(--ink)]">{[m.nowTitle, m.nowCompany].filter(Boolean).join(", ") || m.outcome || "—"}</strong>
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => setOpen(open === m.pid ? null : m.pid)} aria-expanded={open === m.pid} className="rounded-full border border-[var(--ink)] px-5 py-2.5 text-base font-semibold">
                {open === m.pid ? "Hide timeline" : "See their path"}
              </button>
              <Link href={`/live/bridge?target=${m.pid}`} className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-base font-semibold text-white">
                Reach someone like this
              </Link>
            </div>
            {open === m.pid && <Timeline pid={m.pid} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MirrorView() {
  return <NeedSession>{() => <MirrorBody />}</NeedSession>;
}
