"use client";

import Link from "next/link";
import { useState } from "react";
import type { FeedOpp, Result } from "@/lib/opportunities/types";
import { OPP_KINDS, OPP_LABELS, type OppKind } from "@/lib/validation/opportunities";

const KIND_TONE: Record<string, string> = {
  job: "var(--blue)",
  internship: "var(--yellow)",
  project: "var(--sage)",
  research: "var(--stone)",
  referral: "var(--red-tile)",
  mentorship: "var(--yellow)",
  event: "var(--blue)",
};

const control =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";

function Card({ o, onInterest }: { o: FeedOpp; onInterest: (id: string, note: string) => Promise<Result> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">(o.interest ? "sent" : "idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    const r = await onInterest(o.id, note);
    if (r.ok) setState("sent");
    else {
      setState("idle");
      setError(r.error ?? "Could not send that.");
    }
  }

  return (
    <li className="reveal rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide" style={{ background: KIND_TONE[o.kind] ?? "var(--stone)" }}>
          {OPP_LABELS[o.kind as OppKind] ?? o.kind}
        </span>
        {o.deadline && <span className="text-xs text-[var(--muted)]">Apply by {o.deadline}</span>}
      </div>
      <h3 className="mt-3 text-xl font-black uppercase leading-tight tracking-tight">{o.title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {[o.company, o.mode, o.location].filter(Boolean).join(" · ") || "Open to your college"}
        {o.poster && (
          <>
            {" · "}
            <Link href={`/people/${o.poster.id}`} className="underline">
              {o.poster.name}
            </Link>
          </>
        )}
      </p>
      <p className="mt-3 line-clamp-3">{o.description}</p>

      {o.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Skills">
          {o.skills.map((s) => (
            <li key={s} className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-medium">
              {s}
            </li>
          ))}
        </ul>
      )}

      {o.reasons.length > 0 && (
        <ul className="mt-4 space-y-1 border-l-4 border-[var(--yellow)] pl-3 text-sm" aria-label="Why this fits">
          {o.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {state === "sent" ? (
        <p role="status" className="mt-4 rounded-xl bg-[var(--blue)]/40 p-3 text-sm">
          Interest sent{o.interest === "seen" ? ". They have seen it." : o.interest === "shortlisted" ? ". You are shortlisted." : "."}
        </p>
      ) : open ? (
        <form onSubmit={send} className="mt-4 space-y-2">
          <label htmlFor={`n-${o.id}`} className="block text-sm font-medium">
            One line for the poster (optional)
          </label>
          <textarea id={`n-${o.id}`} className={control} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && (
            <p role="alert" className="text-sm text-[var(--red)]">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={state === "sending"} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {state === "sending" ? "Sending…" : "Send interest"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-[var(--ink)] px-5 py-2 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" data-magnetic onClick={() => setOpen(true)} className="mt-4 rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white">
          I&apos;m interested
        </button>
      )}
    </li>
  );
}

/** Presentational feed: filters, search and ranked cards. */
export function OpportunityFeed({
  items,
  canPost,
  kind,
  q,
  onKind,
  onQuery,
  onInterest,
}: {
  items: FeedOpp[];
  canPost: boolean;
  kind: string;
  q: string;
  onKind: (k: string) => void;
  onQuery: (q: string) => void;
  onInterest: (id: string, note: string) => Promise<Result>;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="opp-q" className="mb-1 block text-sm font-medium">
            Search
          </label>
          <input id="opp-q" type="search" className={control} value={q} onChange={(e) => onQuery(e.target.value)} placeholder="react, mentoring, Cognizant" />
        </div>
        <div className="flex flex-wrap gap-2">
          {canPost && (
            <>
              <Link href="/opportunities/mine" className="rounded-full border border-[var(--ink)] px-5 py-2 text-sm font-semibold">
                My posts
              </Link>
              <Link href="/opportunities/new" data-magnetic className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white">
                + Post one
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
        {["", ...OPP_KINDS].map((k) => (
          <button
            key={k || "all"}
            type="button"
            onClick={() => onKind(k)}
            aria-pressed={kind === k}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${kind === k ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--ink)]/25 bg-white"}`}
          >
            {k ? OPP_LABELS[k as OppKind] : "All"}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-[22px] bg-white p-6 text-[var(--muted)]">Nothing here yet. Try another filter, or check back soon.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map((o) => (
            <Card key={o.id} o={o} onInterest={onInterest} />
          ))}
        </ul>
      )}
    </div>
  );
}
