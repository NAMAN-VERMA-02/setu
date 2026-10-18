"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { KIND_LABELS, type NotificationItem } from "@/lib/notifications/types";

type Props = {
  items: NotificationItem[];
  loading?: boolean;
  emailDigest: boolean;
  onMarkAll: () => void;
  onOpen: (item: NotificationItem) => void;
  onDigest: (on: boolean) => void;
};

const subscribe = (tick: () => void) => {
  const t = setInterval(tick, 60_000);
  return () => clearInterval(t);
};
const minute = () => Math.floor(Date.now() / 60_000) * 60_000;

/** The current minute on the client; 0 while rendering on the server so both agree at hydration. */
const useNow = () => useSyncExternalStore(subscribe, minute, () => 0);

const ago = (iso: string, now: number) => {
  if (now === 0) return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
};

/** Everything that happened around you, newest first, with the weekly-email switch. */
export function NotificationList({ items, loading, emailDigest, onMarkAll, onOpen, onDigest }: Props) {
  const unread = items.filter((i) => !i.read).length;
  const now = useNow();

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <section aria-labelledby="n-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="n-h" className="text-2xl font-black uppercase tracking-tight">
            Updates <span className="text-[var(--muted)]">{unread} new</span>
          </h2>
          <button type="button" onClick={onMarkAll} disabled={unread === 0} className="rounded-full border border-[var(--ink)] px-4 py-1.5 text-sm font-semibold hover:bg-[var(--ink)] hover:text-white disabled:opacity-40">
            Mark all read
          </button>
        </div>

        {loading ? (
          <p className="text-[var(--muted)]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="rounded-[22px] bg-white p-6 text-[var(--muted)]">Nothing yet. New requests, vouches and college news show up here.</p>
        ) : (
          <ul className="divide-y divide-black/5 rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
            {items.map((n) => {
              const inner = (
                <>
                  <span aria-hidden className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-[var(--red-tile)]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                    <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {KIND_LABELS[n.kind]} · <span suppressHydrationWarning>{ago(n.createdAt, now)}</span>
                    </span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} onClick={() => onOpen(n)} className="flex gap-3 px-5 py-3 transition-colors hover:bg-[var(--paper)]">
                      {inner}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => onOpen(n)} className="flex w-full gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--paper)]">
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="h-fit space-y-3 rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <h2 className="text-xl font-black uppercase tracking-tight">Weekly email</h2>
        <p className="text-sm text-[var(--muted)]">One short email on Mondays with what is waiting for you and new opportunities at your college. Nothing is sent in a quiet week.</p>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={emailDigest} onChange={(e) => onDigest(e.target.checked)} className="h-5 w-5" />
          Send me the weekly email
        </label>
        <p className="border-t border-black/5 pt-3 text-sm">
          <Link href="/announcements" className="font-semibold underline">College news and events</Link>
        </p>
      </aside>
    </div>
  );
}
