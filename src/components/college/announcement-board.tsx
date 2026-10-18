"use client";

import { useState } from "react";
import type { AnnouncementInput, AnnouncementItem } from "@/lib/validation/announcements";

type Props = {
  items: AnnouncementItem[];
  loading?: boolean;
  canPost: boolean;
  onPost: (input: AnnouncementInput) => Promise<string | null>;
  onRemove: (id: string) => Promise<void>;
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** What the college is saying: announcements and upcoming events, with a form for the placement cell. */
export function AnnouncementBoard({ items, loading, canPost, onPost, onRemove }: Props) {
  const [kind, setKind] = useState<"announcement" | "event">("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const eventAt = kind === "event" && when ? new Date(when).toISOString() : undefined;
    const problem = await onPost({ kind, title, body, eventAt });
    setBusy(false);
    if (problem) return setError(problem);
    setTitle("");
    setBody("");
    setWhen("");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <section aria-labelledby="ann-h">
        <h2 id="ann-h" className="sr-only">Announcements</h2>
        {loading ? (
          <p className="text-[var(--muted)]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="rounded-[22px] bg-white p-6 text-[var(--muted)]">Nothing posted yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className="rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase ${a.kind === "event" ? "bg-[var(--blue)]" : "bg-[var(--yellow)]"}`}>{a.kind === "event" ? "Event" : "Announcement"}</span>
                  <span suppressHydrationWarning className="text-xs text-[var(--muted)]">{fmt(a.createdAt)}</span>
                  {a.mine && (
                    <button type="button" onClick={() => void onRemove(a.id)} className="ml-auto text-xs font-semibold text-[var(--muted)] underline">
                      Remove
                    </button>
                  )}
                </div>
                <h3 className="mt-2 text-xl font-black tracking-tight">{a.title}</h3>
                {a.eventAt && <p suppressHydrationWarning className="mt-1 text-sm font-semibold">{fmt(a.eventAt)}</p>}
                <p className="mt-2 whitespace-pre-wrap">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canPost && (
        <form onSubmit={submit} className="h-fit space-y-3 rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)] lg:sticky lg:top-24">
          <h2 className="text-xl font-black uppercase tracking-tight">Post to your college</h2>
          <div className="flex gap-1" role="group" aria-label="Kind">
            {(["announcement", "event"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${kind === k ? "bg-[var(--ink)] text-white" : "bg-[var(--paper)]"}`}>
                {k}
              </button>
            ))}
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Title" aria-label="Title" className="w-full rounded-xl border border-black/10 px-3 py-2" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required rows={4} placeholder="What should people know?" aria-label="Details" className="w-full rounded-xl border border-black/10 px-3 py-2" />
          {kind === "event" && <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required aria-label="Date and time" className="w-full rounded-xl border border-black/10 px-3 py-2" />}
          {error && <p role="alert" className="text-sm text-[var(--red-tile)]">{error}</p>}
          <button disabled={busy || title.trim().length < 3 || !body.trim()} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Posting…" : "Post"}
          </button>
        </form>
      )}
    </div>
  );
}
