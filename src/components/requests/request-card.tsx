"use client";

import { useState } from "react";
import { TRUST_LABELS, canAdvance, daysLeft, nextStep } from "@/lib/asks/trust";
import type { ActionResult, ReceivedAsk, SentAsk } from "@/lib/asks/types";
import { ForwardLink } from "./forward-link";
import { TrustLadder } from "./trust-ladder";

export type OnAction = (id: string, body: Record<string, unknown>) => Promise<ActionResult>;

const btnPrimary = "rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const btnGhost = "rounded-full border border-[var(--ink)] px-4 py-2 text-sm font-semibold disabled:opacity-50";

function Expiry({ expiresAt, closed }: { expiresAt: string; closed: boolean }) {
  if (closed) return <span className="text-xs text-[var(--muted)]">Closed</span>;
  const d = daysLeft(expiresAt);
  return <span className="text-xs text-[var(--muted)]">{d === 1 ? "1 day left" : `${d} days left`}</span>;
}

function Shell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <li className="rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]" aria-label={label}>
      {children}
    </li>
  );
}

function useAction(onAction: OnAction, id: string, onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(body: Record<string, unknown>): Promise<ActionResult> {
    setBusy(true);
    setError("");
    const result = await onAction(id, body);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "That did not work. Please try again.");
    else onChanged();
    return result;
  }
  return { busy, error, run };
}

const isClosed = (status: string) => status === "expired" || status === "cancelled" || status === "declined";

/** A request someone sent me: answer, move up the trust ladder, or pass it on. */
export function ReceivedCard({ ask, onAction, onChanged }: { ask: ReceivedAsk; onAction: OnAction; onChanged: () => void }) {
  const { busy, error, run } = useAction(onAction, ask.id, onChanged);
  const [link, setLink] = useState<{ url: string; expiresAt?: string } | null>(null);

  const closed = isClosed(ask.status);
  const next = nextStep(ask.trustStep);
  const unlock = canAdvance(ask.trustStep, ask.workSeen);
  const isBridge = ask.role === "via";
  const name = ask.counterpart.name ?? "A student";

  async function forward() {
    const result = await run({ action: "forward" });
    if (result.ok && result.link) setLink({ url: result.link, expiresAt: result.expiresAt });
  }

  return (
    <Shell label={`Request from ${name}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black uppercase leading-tight">{name}</h3>
          <p className="text-sm text-[var(--muted)]">
            {isBridge ? `Hopes you can pass this on to someone at ${ask.targetCompany ?? "their target company"}` : "Is asking you directly"}
          </p>
        </div>
        <Expiry expiresAt={ask.expiresAt} closed={closed} />
      </div>

      <p className="mt-3 whitespace-pre-wrap border-l-4 border-[var(--yellow)] pl-3">{ask.message}</p>

      <div className="mt-5">
        <TrustLadder step={ask.trustStep} />
      </div>

      {ask.workUrl && (
        <p className="mt-4 text-sm">
          <a href={ask.workUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline">
            See their work
          </a>
          {ask.workSeen ? <span className="ml-2 text-[var(--muted)]">You have seen it</span> : null}
        </p>
      )}

      {ask.replyNote && (
        <p className="mt-4 rounded-xl bg-[var(--blue)]/40 p-3 text-sm">
          <span className="font-semibold">Reply:</span> {ask.replyNote}
        </p>
      )}
      {ask.status === "replied" && !ask.replyNote && (
        <p className="mt-4 rounded-xl bg-[var(--blue)]/40 p-3 text-sm">Someone you forwarded this to said they can help.</p>
      )}

      {!closed && (
        <div className="mt-5 flex flex-wrap gap-2">
          {ask.status === "pending" && (
            <button type="button" disabled={busy} onClick={() => run({ action: "accept" })} className={btnPrimary}>
              Accept
            </button>
          )}

          {isBridge && !ask.forwarded && (
            <button type="button" disabled={busy} onClick={forward} className={btnPrimary}>
              Forward to someone I know
            </button>
          )}

          {!isBridge && next && ask.status === "accepted" && (
            <button type="button" disabled={busy || !unlock} onClick={() => run({ action: "advance" })} className={btnPrimary}>
              Unlock next step: {TRUST_LABELS[next]}
            </button>
          )}

          {!isBridge && ask.workUrl && !ask.workSeen && (
            <button type="button" disabled={busy} onClick={() => run({ action: "mark_work_seen" })} className={btnGhost}>
              I have seen their work
            </button>
          )}

          {ask.status !== "replied" && (
            <button type="button" disabled={busy} onClick={() => run({ action: "decline" })} className={btnGhost}>
              Decline quietly
            </button>
          )}
        </div>
      )}

      {!closed && !isBridge && next === "referral" && !ask.workSeen && ask.status === "accepted" && (
        <p className="mt-2 text-xs text-[var(--muted)]">A referral unlocks only after you have seen their work.</p>
      )}
      {!closed && ask.status !== "replied" && (
        <p className="mt-2 text-xs text-[var(--muted)]">Declining is silent. They are not told, and it costs you nothing.</p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--red)]">
          {error}
        </p>
      )}

      {link && <ForwardLink link={link.url} expiresAt={link.expiresAt} company={ask.targetCompany} onDone={() => setLink(null)} />}
    </Shell>
  );
}

const STATUS_TEXT: Record<string, string> = {
  pending: "Waiting for a reply",
  accepted: "Accepted",
  forwarded: "Passed on to someone they know",
  replied: "Someone said they can help",
  expired: "Expired",
  cancelled: "Cancelled",
  declined: "Waiting for a reply",
};

/** A request I sent: where it stands, share work for the task step, or cancel. */
export function SentCard({ ask, onAction, onChanged }: { ask: SentAsk; onAction: OnAction; onChanged: () => void }) {
  const { busy, error, run } = useAction(onAction, ask.id, onChanged);
  const [url, setUrl] = useState("");

  const closed = isClosed(ask.status);
  const name = ask.counterpart.name ?? "A senior";
  const canShareWork = !closed && ask.trustStep === "task" && !ask.workUrl;

  async function submitWork(e: React.FormEvent) {
    e.preventDefault();
    const result = await run({ action: "submit_work", workUrl: url });
    if (result.ok) setUrl("");
  }

  return (
    <Shell label={`Request to ${name}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black uppercase leading-tight">{name}</h3>
          <p className="text-sm text-[var(--muted)]">
            {ask.kind === "bridge" ? `Asked to pass it on to someone at ${ask.targetCompany ?? "your target company"}` : "Asked directly"}
          </p>
        </div>
        <Expiry expiresAt={ask.expiresAt} closed={closed} />
      </div>

      <p className="mt-3 inline-block rounded-full bg-[var(--paper)] px-3 py-1 text-sm font-medium">{STATUS_TEXT[ask.status] ?? ask.status}</p>
      <p className="mt-3 whitespace-pre-wrap border-l-4 border-[var(--yellow)] pl-3">{ask.message}</p>

      <div className="mt-5">
        <TrustLadder step={ask.trustStep} />
      </div>

      {ask.replyNote && (
        <p className="mt-4 rounded-xl bg-[var(--blue)]/40 p-3 text-sm">
          <span className="font-semibold">Reply:</span> {ask.replyNote}
        </p>
      )}

      {ask.workUrl && (
        <p className="mt-4 text-sm">
          <a href={ask.workUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline">
            Your shared work
          </a>
          <span className="ml-2 text-[var(--muted)]">{ask.workSeen ? "They have seen it" : "Not seen yet"}</span>
        </p>
      )}

      {canShareWork && (
        <form onSubmit={submitWork} className="mt-4 space-y-2">
          <label htmlFor={`work-${ask.id}`} className="block text-sm font-medium">
            Share your small task (https link)
          </label>
          <div className="flex gap-2">
            <input
              id={`work-${ask.id}`}
              type="url"
              required
              placeholder="https://github.com/you/project"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
            />
            <button type="submit" disabled={busy} className={btnPrimary}>
              Share
            </button>
          </div>
        </form>
      )}

      {!closed && (
        <div className="mt-5">
          <button type="button" disabled={busy} onClick={() => run({ action: "cancel" })} className={btnGhost}>
            Cancel request
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--red)]">
          {error}
        </p>
      )}
    </Shell>
  );
}
