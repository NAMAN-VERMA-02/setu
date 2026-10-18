"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { api, useFedLive, type ViewerTokens } from "@/lib/fed/client";
import { DOMAIN_LABEL } from "@/lib/fed/taxonomy";

type Card = { pid: string; node: string; role: string; branch?: string | null; label: string; title: string | null; company: string | null; gradYear: number | null };
type HopContext = {
  hop: { id: string; status: "waiting" | "sent" | "accepted" | "declined" | "cancelled"; isTarget: boolean; position: number; total: number };
  intro: { id: string; status: string; trustStep: string; workSeen: boolean; response: string | null };
  me: Card & { storyKey: string | null };
  requester: Card;
  target: Card;
  events: { id: number; kind: string; text: string }[];
  read: { url: string; token: string; requesterPid: string; node: string } | null;
  viewer: ViewerTokens;
};
type Ask = { text: string; work_url: string | null; notes: { author_pid: string; text: string }[] };

const CHOICES = [
  { v: "question", label: "Answer a question", points: 10 },
  { v: "call", label: "A 15-minute call", points: 25 },
  { v: "referral", label: "Give a referral", points: 50 },
] as const;

/** Who is asking, in role words only: "a Healthcare professional" or "an NGIT student". */
function asker(r: { node: string; role: string; branch?: string | null }): string {
  if (r.role === "professional") return `${DOMAIN_LABEL[r.branch ?? ""] ?? "Setu"} professional`;
  return `${r.node.toUpperCase()} ${r.role === "alum" ? "alum" : "student"}`;
}

function buzz() {
  try {
    navigator.vibrate?.(200);
  } catch {
    // not supported
  }
}

export function HopView({ paramsPromise }: { paramsPromise: Promise<{ token: string }> }) {
  const { token } = use(paramsPromise);
  const [ctx, setCtx] = useState<HopContext | null>(null);
  const [error, setError] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [requesterName, setRequesterName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState<"question" | "call" | "referral">("call");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { accepted: boolean; points: number }>(null);
  const [confirmNo, setConfirmNo] = useState(false);
  const seenEvents = useRef(0);

  const load = useCallback(async () => {
    const r = await api<HopContext & { error?: string }>(`/api/fed/hop/${token}`);
    if (!r.ok) return setError(r.data.error ?? "This link is not valid.");
    setCtx(r.data);
    if (r.data.events.length > seenEvents.current && seenEvents.current > 0) buzz();
    seenEvents.current = r.data.events.length;
  }, [token]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_hops", "fed_intros", "fed_events", "fed_ledger"], load);

  // the requester's name and ask come straight from the requester's own college server
  const readUrl = ctx?.read?.url;
  const readToken = ctx?.read?.token;
  const introId = ctx?.intro.id;
  const requesterPid = ctx?.read?.requesterPid;
  const hopStatus = ctx?.hop.status;
  useEffect(() => {
    if (!readUrl || !readToken || !introId || !requesterPid) return;
    let alive = true;
    const headers = { "x-setu-viewer": readToken };
    fetch(`${readUrl}/public/asks/${introId}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => alive && a && setAsk(a))
      .catch(() => {});
    fetch(`${readUrl}/public/card/${requesterPid}`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { name?: string } | null) => alive && c?.name && setRequesterName(c.name))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [readUrl, readToken, introId, requesterPid, hopStatus]);

  async function act(accept: boolean) {
    if (!ctx) return;
    setBusy(true);
    setError("");
    if (accept && note.trim() && ctx.read) {
      await fetch(`${ctx.read.url}/public/asks/${ctx.intro.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-setu-viewer": ctx.read.token },
        body: JSON.stringify({ text: note.trim() }),
      }).catch(() => {});
    }
    const r = await api<{ error?: string; accepted?: boolean }>(`/api/fed/hop/${token}`, {
      method: "POST",
      json: { accept, ...(accept && ctx.hop.isTarget ? { response: choice } : {}) },
    });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "We could not record that.");
    const points = accept ? (ctx.hop.isTarget ? CHOICES.find((c) => c.v === choice)!.points : 10) : 0;
    setDone({ accepted: accept, points });
    void load();
  }

  if (error && !ctx) return <Shell><p role="alert" className="text-xl font-bold text-[var(--red)]">{error}</p></Shell>;
  if (!ctx) return <Shell><div className="h-48 animate-pulse rounded-2xl bg-[var(--surface)]" role="status" aria-label="Loading" /></Shell>;

  const { hop, intro, me } = ctx;
  const answered = hop.status === "accepted" || hop.status === "declined" || done;
  const hired = ctx.events.some((e) => e.kind === "hired");
  const lockedReferral = !intro.workSeen;

  return (
    <Shell persona={me.storyKey ? me.label : null}>
      <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
        Hop {hop.position} of {hop.total}
      </p>
      <h1 className="mt-1 text-4xl font-black leading-[1.05] tracking-tight">
        A {asker(ctx.requester)} wants to reach a {ctx.target.title ?? "professional"} at {ctx.target.company ?? "a company"}.
      </h1>
      <p className="mt-3 text-xl text-[var(--muted)]">{hop.isTarget ? "You’re the person they want to reach." : `You’re hop ${hop.position} of ${hop.total}: pass it on if you can.`}</p>

      <section className="mt-5 rounded-2xl bg-[var(--surface)] p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <p className="text-lg font-bold">{requesterName ?? "Someone on Setu"}</p>
        {ask ? (
          <>
            <p className="mt-2 whitespace-pre-line text-xl">{ask.text}</p>
            {ask.work_url && (
              <a href={ask.work_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-lg font-semibold underline">
                Their work
              </a>
            )}
            {ask.notes.map((n, i) => (
              <p key={i} className="mt-3 rounded-xl bg-[var(--paper)] p-3 text-lg">
                “{n.text}”
              </p>
            ))}
          </>
        ) : (
          <p className="mt-2 text-[var(--muted)]">Loading their message from {ctx.requester.node.toUpperCase()}’s server…</p>
        )}
      </section>

      {!answered && hop.status === "sent" && (
        <section className="mt-5 space-y-4">
          {hop.isTarget ? (
            <fieldset>
              <legend className="text-lg font-bold">How can you help?</legend>
              <div className="mt-2 grid gap-2">
                {CHOICES.map((c) => {
                  const locked = c.v === "referral" && lockedReferral;
                  return (
                    <label key={c.v} className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-xl font-bold ${choice === c.v ? "border-[var(--ink)] bg-[var(--surface)]" : "border-transparent bg-[var(--surface)]"} ${locked ? "opacity-50" : ""}`}>
                      <span>
                        <input type="radio" name="choice" className="sr-only" disabled={locked} checked={choice === c.v} onChange={() => setChoice(c.v)} />
                        {c.label}
                        {locked && <span className="ml-2 text-base font-normal">🔒 after they show work</span>}
                      </span>
                      <span className="text-[var(--muted)]">+{c.points}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <label className="block text-lg font-semibold">
            Add a note <span className="font-normal text-[var(--muted)]">(optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} className="mt-1 w-full rounded-xl border border-[var(--ink)]/20 bg-[var(--surface)] p-3 text-lg" />
          </label>
          {error && <p role="alert" className="text-[var(--red)]">{error}</p>}
          <button type="button" disabled={busy} onClick={() => act(true)} className="w-full rounded-full bg-[var(--ink)] px-6 py-5 text-2xl font-black text-white disabled:opacity-60">
            {hop.isTarget ? "Yes, I’ll help" : "Yes, pass it on"}
          </button>
          {!confirmNo ? (
            <button type="button" onClick={() => setConfirmNo(true)} className="w-full rounded-full border-2 border-[var(--ink)] px-6 py-4 text-xl font-bold">
              No
            </button>
          ) : (
            <div className="rounded-2xl bg-[var(--surface)] p-4">
              <p className="text-lg font-bold">They won’t be told it was you.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => act(false)} className="rounded-full bg-[var(--red-tile)] px-4 py-4 text-xl font-black text-white">
                  Decline quietly
                </button>
                <button type="button" onClick={() => setConfirmNo(false)} className="rounded-full border-2 border-[var(--ink)] px-4 py-4 text-xl font-bold">
                  Go back
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {answered && (
        <section className="mt-5 rounded-2xl bg-[var(--sage)] p-6 text-center" aria-live="polite">
          {hop.status === "declined" || (done && !done.accepted) ? (
            <p className="text-2xl font-black">Done. They won’t be told it was you.</p>
          ) : (
            <>
              <p className="points-pop text-7xl font-black tabular-nums">+{done?.points ?? 10}</p>
              <p className="mt-1 text-2xl font-black">Points</p>
              <p className="mt-2 text-lg">Thank you. Setu will tell you if they get the offer: everyone on the chain earns +100.</p>
            </>
          )}
        </section>
      )}

      {hired && (
        <section className="mt-5 rounded-2xl bg-[var(--ink)] p-6 text-center text-white" aria-live="polite">
          <p className="points-pop text-7xl font-black">+100</p>
          <p className="mt-2 text-2xl font-black">They got the offer</p>
        </section>
      )}

      {hop.status === "waiting" && <p className="mt-5 rounded-2xl bg-[var(--surface)] p-5 text-lg">Not your turn yet. This page will open up when it reaches you.</p>}
      {hop.status === "cancelled" && <p className="mt-5 rounded-2xl bg-[var(--surface)] p-5 text-lg">This intro found another route. Thank you anyway.</p>}
    </Shell>
  );
}

function Shell({ children, persona }: { children: React.ReactNode; persona?: string | null }) {
  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16 pt-6 text-lg">
      <div className="mb-5 flex items-center justify-between gap-2">
        <span className="text-2xl font-black uppercase tracking-tight">SETU</span>
        {persona && <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-sm font-semibold text-white">Playing {persona}</span>}
      </div>
      {children}
    </div>
  );
}
