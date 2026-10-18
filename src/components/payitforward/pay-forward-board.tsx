"use client";

import { useState } from "react";
import type { PayItForwardResponse } from "@/lib/validation/payforward";

export type Result = { ok: boolean; error?: string };
export type PayForwardHandlers = {
  reportSuccess: (company: string) => Promise<Result>;
  answer: (juniorId: string, answer: string) => Promise<Result>;
  onChanged: () => void;
};

const control =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";
const primary = "rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60";

/** Three dots: how many of the three answers have been given. */
function Progress({ done }: { done: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`${done} of 3 answers given`}>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className={`grid size-8 place-items-center rounded-full border-2 text-sm font-bold ${
            i < done ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--ink)]/25 bg-white text-[var(--muted)]"
          }`}
        >
          {i < done ? "✓" : i + 1}
        </li>
      ))}
    </ol>
  );
}

function SuccessForm({ h }: { h: PayForwardHandlers }) {
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await h.reportSuccess(company);
    setBusy(false);
    if (r.ok) h.onChanged();
    else setError(r.error ?? "Could not save that.");
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[22px] bg-[var(--yellow)] p-6">
      <h2 className="text-3xl font-black uppercase leading-none tracking-tight">Did you land it?</h2>
      <p>
        Tell us where, and we will show you three juniors standing exactly where you once stood. One answer from you
        each can change their next step.
      </p>
      <div>
        <label htmlFor="company" className="mb-1 block text-sm font-medium">
          Company (optional)
        </label>
        <input id="company" className={control} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} placeholder="Cognizant" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--red)]">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={primary}>
        {busy ? "Saving…" : "I got it"}
      </button>
    </form>
  );
}

function CandidateCard({ c, h }: { c: PayItForwardResponse["candidates"][number]; h: PayForwardHandlers }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await h.answer(c.id, answer);
    setBusy(false);
    if (r.ok) h.onChanged();
    else setError(r.error ?? "Could not send your answer.");
  }

  return (
    <li className="rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
      <h3 className="text-lg font-black uppercase leading-tight">{c.displayName}</h3>
      <p className="text-sm text-[var(--muted)]">
        Batch {c.batch} · {c.branch} · semester {c.semester}
        {c.goalTarget ? ` · aiming for ${c.goalTarget}` : ""}
      </p>
      <p className="mt-3 text-sm">{c.firstLine}</p>
      <p className="mt-3 border-l-4 border-[var(--yellow)] pl-3 text-base font-medium">{c.question}</p>

      <form onSubmit={send} className="mt-4 space-y-3">
        <label htmlFor={`a-${c.id}`} className="block text-sm font-medium">
          Your answer
        </label>
        <textarea id={`a-${c.id}`} className={control} rows={4} maxLength={1000} required value={answer} onChange={(e) => setAnswer(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-[var(--red)]">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || answer.trim().length === 0} className={primary}>
          {busy ? "Sending…" : "Send answer"}
        </button>
      </form>
    </li>
  );
}

/** The pay-it-forward screen: report a success, answer three juniors, and read answers you received. */
export function PayForwardBoard({ data, handlers }: { data: PayItForwardResponse; handlers: PayForwardHandlers }) {
  const done = Math.min(3, data.answered);

  return (
    <div className="space-y-12">
      {!data.succeeded && <SuccessForm h={handlers} />}

      {data.succeeded && (
        <section aria-labelledby="give-h" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="give-h" className="text-3xl font-black uppercase leading-none tracking-tight">
                {data.helpOwed > 0 ? "Help three juniors" : "You paid it forward"}
              </h2>
              <p className="mt-2 text-[var(--muted)]">
                {data.helpOwed > 0
                  ? `Congratulations${data.company ? ` on ${data.company}` : ""}! These juniors stand where you once stood. Answer one question from each.`
                  : "Three juniors have an answer from someone who was where they are. Thank you."}
              </p>
            </div>
            <Progress done={done} />
          </div>

          {data.helpOwed > 0 && data.candidates.length === 0 && (
            <p className="rounded-[22px] bg-white p-5 text-[var(--muted)]">
              No juniors with an open question match you yet. Check back as more students join.
            </p>
          )}
          {data.candidates.length > 0 && (
            <ul className="grid gap-4 lg:grid-cols-3">
              {data.candidates.map((c) => (
                <CandidateCard key={c.id} c={c} h={handlers} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="got-h">
        <h2 id="got-h" className="mb-4 text-2xl font-black uppercase tracking-tight">
          Answers you received
        </h2>
        {data.received.length === 0 ? (
          <p className="rounded-[22px] bg-white p-5 text-[var(--muted)]">
            Add one question to your journey. When a senior lands a role, they may answer it.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.received.map((r) => (
              <li key={r.id} className="rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
                <p className="border-l-4 border-[var(--yellow)] pl-3 font-medium">{r.question}</p>
                <p className="mt-3 whitespace-pre-wrap">{r.answer}</p>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  From a senior{r.helper.batch ? ` · batch ${r.helper.batch}` : ""}
                  {r.helper.branch ? ` · ${r.helper.branch}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
