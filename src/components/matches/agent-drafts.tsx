"use client";

import Link from "next/link";
import { useState } from "react";
import { createAsk } from "@/lib/asks/client";
import { requestDrafts, type DraftsResponse } from "@/lib/agent/client";
import type { CheckedDraft } from "@/lib/agent/guardrails";

const DEMO: DraftsResponse = {
  drafts: [
    {
      matchId: "a",
      displayName: "Amit Sharma (sample)",
      route: "bridge",
      targetCompany: "Cognizant",
      message:
        "You also had 1 backlog in semester 5.\n\nI am aiming for an SDE role at Cognizant and I am in the same semester you were. Could you pass this question on to someone you know there: what do juniors with a backlog do to stand out in the online test?",
      why: "Same backlog, and knows 3 people at Cognizant.",
    },
    {
      matchId: "b",
      displayName: "Riya Verma (sample)",
      route: "direct",
      targetCompany: null,
      message: "In semester 5 you were both aiming for a job.\n\nWhich one project did you spend the most time on before placements?",
      why: "Same direction in the same semester.",
    },
  ],
  notes: [],
};

function DraftCard({ draft, demo, onDone }: { draft: CheckedDraft; demo?: boolean; onDone: () => void }) {
  const [message, setMessage] = useState(draft.message);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send() {
    setState("sending");
    setError("");
    const body =
      draft.route === "bridge" && draft.targetCompany
        ? { kind: "bridge", viaId: draft.matchId, targetCompany: draft.targetCompany, message }
        : { kind: "direct", targetId: draft.matchId, message };
    const r = demo ? { ok: true } : await createAsk(body);
    if (r.ok) setState("sent");
    else {
      setState("idle");
      setError(r.error ?? "Could not send your request.");
    }
  }

  if (state === "sent") {
    return (
      <li className="rounded-2xl bg-[var(--blue)]/40 p-4 text-sm" role="status">
        Sent to {draft.displayName.split(" ")[0]}.{" "}
        <Link href="/requests" className="font-semibold underline">
          Follow it in Requests
        </Link>
      </li>
    );
  }

  return (
    <li className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-black uppercase">{draft.displayName}</h4>
        <span className="rounded-full bg-[var(--paper)] px-3 py-0.5 text-xs font-medium">
          {draft.route === "bridge" ? `Pass it on at ${draft.targetCompany}` : "Ask directly"}
        </span>
      </div>
      {draft.why && <p className="mt-1 text-sm text-[var(--muted)]">{draft.why}</p>}
      <label htmlFor={`d-${draft.matchId}`} className="sr-only">
        Message to {draft.displayName}
      </label>
      <textarea
        id={`d-${draft.matchId}`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        maxLength={2000}
        className="mt-3 w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--red)]">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={send}
          disabled={state === "sending" || message.trim().length === 0}
          className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={onDone} className="rounded-full border border-[var(--ink)] px-5 py-2 text-sm font-semibold">
          Discard
        </button>
      </div>
    </li>
  );
}

/** Asks the drafting assistant for first messages. The student edits and sends each one. */
export function AgentDrafts({ demo }: { demo?: boolean }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [data, setData] = useState<DraftsResponse | null>(null);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  async function draft() {
    setState("loading");
    setError("");
    setHidden(new Set());
    const res = demo ? { data: DEMO } : await requestDrafts();
    if (res.data) {
      setData(res.data);
      setState("done");
    } else {
      setError(res.error ?? "We could not draft messages.");
      setState("idle");
    }
  }

  const visible = (data?.drafts ?? []).filter((d) => !hidden.has(d.matchId));

  return (
    <section aria-labelledby="agent-h" className="rounded-[22px] bg-[var(--yellow)] p-5 sm:p-6">
      <h2 id="agent-h" className="text-2xl font-black uppercase leading-none tracking-tight">
        Not sure what to say?
      </h2>
      <p className="mt-2 text-sm">
        An assistant reads your journey and matches and drafts a first message for up to three seniors. Nothing is
        sent until you press Send, and every draft is just a starting point you can edit.
      </p>
      <button
        type="button"
        onClick={draft}
        disabled={state === "loading"}
        className="mt-4 rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {state === "loading" ? "Reading your journey…" : data ? "Draft again" : "Draft messages for me"}
      </button>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-[var(--red)]">
            {error}
          </p>
        )}
        {state === "done" && visible.length === 0 && (
          <p className="mt-3 text-sm">We could not write a safe draft this time. You can still write your own below.</p>
        )}
        {visible.length > 0 && (
          <ul className="mt-4 grid gap-4 lg:grid-cols-2">
            {visible.map((d) => (
              <DraftCard key={d.matchId} draft={d} demo={demo} onDone={() => setHidden((h) => new Set(h).add(d.matchId))} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
