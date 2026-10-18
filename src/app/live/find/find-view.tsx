"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NeedSession } from "@/components/live/need-session";
import { api, COLLEGE_COLOUR, useFedLive, type SessionInfo, type ViewerTokens } from "@/lib/fed/client";
import { DOMAIN_LABEL, NEED_EXAMPLES } from "@/lib/fed/taxonomy";

type Result = {
  pid: string;
  node: string;
  percent: number;
  label: string;
  title: string | null;
  company: string | null;
  domainLabel: string | null;
  yearsExp: number | null;
  reasons: string[];
  openTo: string[];
  route: { chance: number; between: number } | null;
};
type Answer = { query: string; results: Result[]; searched: { node: string; ok: boolean }[]; skippedOffline: string[] };
type Me = { about?: string | null; needs?: string[]; domain?: string | null };

const NODE_NAME: Record<string, string> = { ngit: "NGIT", rce: "RCE", pro: "Professionals" };
const pct = (n: number) => `${(n * 100).toFixed(n * 100 >= 10 ? 1 : 2).replace(/\.0+$/, "")}%`;

function FindBody({ session, viewer }: { session: SessionInfo; viewer: ViewerTokens }) {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mine, setMine] = useState<Me | null>(null);

  const run = useCallback(async (text: string) => {
    if (text.trim().length < 2) return;
    setBusy(true);
    setError("");
    const r = await api<Answer & { error?: string }>("/api/fed/match", { method: "POST", json: { query: text } });
    setBusy(false);
    if (r.ok) setAns(r.data);
    else setError(r.data.error ?? "Could not search right now.");
  }, []);

  // A professional's own words about what they need are read straight from their own server, on this device.
  const own = viewer[session.node];
  useEffect(() => {
    if (session.role !== "professional" || !own) return;
    let alive = true;
    fetch(`${own.url}/public/me`, { headers: { "x-setu-viewer": own.token } })
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then((m) => {
        if (!alive || !m) return;
        setMine(m);
        if (m.about) setQ(m.about);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [session.role, own]);

  // a server going offline or coming back changes who can answer. The hub now writes a server's state only when it
  // changes, so this fires on a real change (a kill switch), not on every search.
  useFedLive(["fed_nodes"], () => {
    if (ans && !busy) void run(ans.query);
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">Find · every profession, one network</p>
        <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">Say who you need.</h1>
        <p className="mt-3 max-w-3xl text-xl text-[var(--muted)]">
          A doctor can find a developer. A founder can find a lawyer. Setu asks every server in the network and shows you the warmest way in.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
        className="rounded-[22px] bg-[var(--surface)] p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]"
      >
        <label htmlFor="need" className="text-base font-bold">
          What do you need? <span className="font-normal text-[var(--muted)]">English or Hinglish</span>
        </label>
        <textarea id="need" value={q} onChange={(e) => setQ(e.target.value)} rows={3} maxLength={300} placeholder="I am a doctor and I need a developer to build a patient follow-up app" className="mt-2 w-full rounded-xl border border-[var(--ink)]/20 bg-[var(--paper)] p-4 text-xl" />
        {mine?.about && (
          <p className="mt-2 text-sm text-[var(--muted)]">Filled in from what you told {session.node.toUpperCase() === "PRO" ? "your" : session.node.toUpperCase()} server. Setu never saw these words.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {NEED_EXAMPLES.map((s) => (
            <button key={s} type="button" onClick={() => (setQ(s), void run(s))} className="rounded-full border border-[var(--ink)]/25 px-4 py-2 text-left text-base">
              {s}
            </button>
          ))}
        </div>
        <button disabled={busy || q.trim().length < 2} className="mt-4 rounded-full bg-[var(--ink)] px-8 py-3 text-xl font-bold text-white disabled:opacity-60">
          {busy ? "Asking every server…" : "Find them"}
        </button>
      </form>

      {error && <p role="alert" className="rounded-xl bg-[var(--surface)] p-4 text-[var(--red)]">{error}</p>}
      {busy && !ans && <div className="h-48 animate-pulse rounded-[22px] bg-[var(--surface)]" role="status" aria-label="Searching" />}

      {/* previous results stay on screen (dimmed) while a refresh runs, so the page never blinks empty */}
      {ans && (
        <section aria-live="polite" aria-busy={busy} className={`space-y-4 transition-opacity ${busy ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-center gap-2 text-base">
            <span className="font-bold">Asked:</span>
            {ans.searched.map((s) => (
              <span key={s.node} className="rounded-full border border-[var(--ink)]/15 px-3 py-1 font-semibold" style={{ color: s.ok ? COLLEGE_COLOUR[s.node] : "var(--muted)" }}>
                {NODE_NAME[s.node] ?? s.node} {s.ok ? "✓" : "offline"}
              </span>
            ))}
            {ans.skippedOffline.length > 0 && <span className="text-[var(--muted)]">{ans.skippedOffline.map((n) => NODE_NAME[n] ?? n).join(", ")} is offline, so its people are not shown.</span>}
          </div>

          {ans.results.length === 0 && <p className="rounded-2xl bg-[var(--surface)] p-6 text-xl text-[var(--muted)]">No one matches that yet. Try naming a profession, like “developer”, “lawyer” or “designer”.</p>}

          <ul className="grid gap-4 lg:grid-cols-2">
            {ans.results.map((r, i) => (
              <li key={r.pid} className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]" style={{ borderLeft: `6px solid ${COLLEGE_COLOUR[r.node]}` }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {i === 0 && <p className="mb-1 text-sm font-bold uppercase tracking-wide text-[#15803d]">Best match</p>}
                    <p className="text-2xl font-black leading-snug">{r.title ?? "Professional"}</p>
                    <p className="text-lg text-[var(--muted)]">
                      {[r.company, r.domainLabel, r.yearsExp ? `${r.yearsExp} yrs` : null].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {r.node === "pro" ? "Setu Professionals" : `${NODE_NAME[r.node]} alum`} · name hidden until they say yes
                    </p>
                  </div>
                  <p className="shrink-0 text-5xl font-black leading-none tabular-nums" aria-label={`${r.percent} percent match`}>
                    {r.percent}
                    <span className="text-2xl">%</span>
                  </p>
                </div>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {r.reasons.map((x) => (
                    <li key={x} className="rounded-full bg-[var(--yellow)]/50 px-3 py-1 text-base font-semibold">
                      {x}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 rounded-xl bg-[var(--paper)] p-3 text-lg">
                  {r.route ? (
                    <>
                      Warmest route: <strong>{pct(r.route.chance)}</strong> chance, through {r.route.between === 0 ? "nobody (direct)" : `${r.route.between} ${r.route.between === 1 ? "person" : "people"} you trust`}
                    </>
                  ) : (
                    <span className="text-[var(--muted)]">No warm route within 3 people yet.</span>
                  )}
                </p>
                <div className="mt-4">
                  <Link href={`/live/bridge?target=${r.pid}`} className="inline-block rounded-full bg-[var(--ink)] px-6 py-3 text-lg font-semibold text-white">
                    Ask for intro
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-[var(--muted)]">
            Fields searched: {Object.values(DOMAIN_LABEL).slice(0, 6).join(", ")} and more. Each server answered with job cards only: no names, no contact details.
          </p>
        </section>
      )}
    </div>
  );
}

export function FindView() {
  return <NeedSession>{({ session, viewer }) => <FindBody session={session} viewer={viewer} />}</NeedSession>;
}
