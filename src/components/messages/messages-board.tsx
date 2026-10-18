"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MessageItem, ThreadItem } from "@/lib/messages/types";

const clean = (name: string) => name.replace(/\s*\(.*?\)\s*/g, " ").trim();
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Props = {
  threads: ThreadItem[];
  activeId: string | null;
  messages: MessageItem[];
  meId: string;
  loading?: boolean;
  error?: string | null;
  onOpen: (threadId: string) => void;
  onSend: (body: string) => Promise<string | null>;
};

/** Thread list on the left, conversation on the right. Stacks on a phone. */
export function MessagesBoard({ threads, activeId, messages, meId, loading, error, onOpen, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const active = threads.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setSendError(null);
    const problem = await onSend(draft.trim());
    setBusy(false);
    if (problem) setSendError(problem);
    else setDraft("");
  }

  return (
    <div className="grid min-h-[28rem] gap-4 md:grid-cols-[18rem_1fr]">
      <aside aria-label="Conversations" className={`${activeId ? "hidden md:block" : ""} rounded-[22px] bg-white p-2 shadow-[0_0_0_1px_rgba(15,15,14,.08)]`}>
        {loading ? (
          <p className="p-4 text-[var(--muted)]">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="p-4 text-[var(--muted)]">
            No conversations yet. Open a connection from <Link href="/network" className="font-semibold underline">your network</Link> and say hello.
          </p>
        ) : (
          <ul>
            {threads.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onOpen(t.id)} aria-current={t.id === activeId} className={`w-full rounded-2xl px-4 py-3 text-left transition-colors hover:bg-[var(--paper)] ${t.id === activeId ? "bg-[var(--paper)]" : ""}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{clean(t.other.name)}</span>
                    {t.unread && <span aria-label="unread" className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--red-tile)]" />}
                  </span>
                  <span className="block truncate text-xs uppercase tracking-wide text-[var(--muted)]">{t.other.role}</span>
                  <span className="block truncate text-sm text-[var(--muted)]">{t.preview ?? "Say hello"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section aria-label="Conversation" className={`${activeId ? "" : "hidden md:flex"} flex min-h-[28rem] flex-col rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(15,15,14,.08)]`}>
        {!active ? (
          <p className="m-auto p-6 text-[var(--muted)]">{error ?? "Choose a conversation."}</p>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-3">
              <div className="min-w-0">
                <Link href={`/people/${active.other.id}`} className="block truncate font-bold underline-offset-2 hover:underline">
                  {clean(active.other.name)}
                </Link>
                {active.other.headline && <p className="truncate text-xs text-[var(--muted)]">{active.other.headline}</p>}
              </div>
              <button type="button" onClick={() => onOpen("")} className="text-sm font-semibold underline md:hidden">
                Back
              </button>
            </header>

            <ol className="flex-1 space-y-2 overflow-y-auto px-5 py-4" aria-live="polite">
              {messages.length === 0 && <li className="text-[var(--muted)]">Nothing here yet. Start with one clear question.</li>}
              {messages.map((m) => {
                const mine = m.senderId === meId;
                return (
                  <li key={m.id} className={`flex ${mine ? "justify-end" : ""}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${mine ? "bg-[var(--ink)] text-white" : "bg-[var(--paper)]"}`}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p suppressHydrationWarning className={`mt-0.5 text-[10px] ${mine ? "text-white/60" : "text-[var(--muted)]"}`}>{when(m.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
              <div ref={endRef} />
            </ol>

            <form onSubmit={submit} className="border-t border-black/5 p-3">
              {sendError && (
                <p role="alert" className="mb-2 text-sm text-[var(--red-tile)]">
                  {sendError}
                </p>
              )}
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="msg">
                  Message
                </label>
                <textarea id="msg" value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={2000} placeholder="Write a message" className="min-h-11 flex-1 resize-none rounded-2xl border border-black/10 px-4 py-2" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
                <button disabled={busy || !draft.trim()} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Send
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
