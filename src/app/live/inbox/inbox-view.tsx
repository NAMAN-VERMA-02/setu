"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useFedLive } from "@/lib/fed/client";

type Item = { hopId: string; status: string; isTarget: boolean; introStatus: string; from: string; to: string; sentAt: string | null; link: string };
type Inbox = { persona: { key: string; label: string }; items: Item[] };

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // audio is optional
  }
}

/** A demo persona's inbox for a teammate's phone. Buzzes when something new is waiting. */
export function InboxView() {
  const as = useSearchParams().get("as") ?? "";
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState("");
  const [sound, setSound] = useState(false);
  const waiting = useRef(0);

  const load = useCallback(async () => {
    const r = await api<Inbox & { error?: string }>(`/api/fed/inbox?as=${encodeURIComponent(as)}`);
    if (!r.ok) return setError(r.data.error ?? "Could not load this inbox.");
    setError("");
    const count = r.data.items.filter((i) => i.status === "sent").length;
    if (count > waiting.current) {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        // not supported
      }
      if (sound) beep();
    }
    waiting.current = count;
    setInbox(r.data);
  }, [as, sound]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_hops"], load);

  if (!as) return <p className="text-xl">Open this page as <code>/live/inbox?as=rohan</code>.</p>;
  if (error) return <p role="alert" className="rounded-xl bg-[var(--surface)] p-5 text-[var(--red)]">{error}</p>;
  if (!inbox) return <div className="h-48 animate-pulse rounded-[22px] bg-[var(--surface)]" role="status" aria-label="Loading" />;

  const waitingItems = inbox.items.filter((i) => i.status === "sent");
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Inbox · demo persona</p>
        <h1 className="text-5xl font-black leading-none">{inbox.persona.label}</h1>
        {!sound && (
          <button type="button" onClick={() => (setSound(true), beep())} className="mt-3 rounded-full border border-[var(--ink)] px-5 py-2 text-base font-semibold">
            Turn on sound
          </button>
        )}
      </header>

      {waitingItems.length === 0 && <p className="rounded-2xl bg-[var(--surface)] p-6 text-xl text-[var(--muted)]">Nothing waiting. This page buzzes the moment something arrives.</p>}

      <ul className="space-y-3">
        {inbox.items.map((i) => (
          <li key={i.hopId}>
            <Link href={i.link} className={`block rounded-2xl p-5 shadow-[0_0_0_1px_rgba(15,15,14,.1)] ${i.status === "sent" ? "bg-[var(--yellow)]/60" : "bg-[var(--surface)]"}`}>
              <p className="text-sm font-bold uppercase tracking-wide">{i.status === "sent" ? "Waiting for you" : i.status}</p>
              <p className="mt-1 text-xl font-bold">{i.from} wants to reach {i.to}</p>
              <p className="mt-1 text-base text-[var(--muted)]">{i.isTarget ? "You’re the person they want to reach" : "Pass it on if you can"} · open →</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
