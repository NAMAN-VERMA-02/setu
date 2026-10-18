"use client";

import { useCallback, useEffect, useState } from "react";
import { Qr } from "@/components/live/qr";
import { api, useFedLive } from "@/lib/fed/client";

type Overlay = { joinQr: boolean; hop: { link: string; label: string } | null; siteUrl: string };

/**
 * Full-screen QR the presenter can put on the projector from /stage: either "join", or the person being asked
 * right now, so a guest can scan it and play that person (tap Yes, pick a call).
 */
export function StageOverlay() {
  const [o, setO] = useState<Overlay | null>(null);
  const load = useCallback(async () => {
    const r = await api<Overlay>("/api/fed/overlay");
    if (r.ok) setO(r.data);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_events", "fed_hops"], load);

  const show = o?.hop
    ? { value: o.hop.link, title: "Scan to play this person", sub: o.hop.label }
    : o?.joinQr
      ? { value: `${o.siteUrl}/join`, title: "Join in 30 seconds", sub: "Your profile goes to your own server, not to Setu." }
      : null;
  if (!show) return null;
  return (
    <div role="dialog" aria-label={show.title} className="fixed inset-0 z-50 grid place-items-center bg-[var(--paper)] p-6">
      <div className="text-center">
        <h2 className="text-5xl font-black uppercase tracking-tight">{show.title}</h2>
        <p className="mt-2 text-2xl text-[var(--muted)]">{show.sub}</p>
        <div className="mt-8 flex justify-center">
          <Qr value={show.value} size={420} label={show.title} />
        </div>
        <p className="mt-6 break-all font-mono text-xl font-bold">{show.value.replace(/^https?:\/\//, "").slice(0, 60)}</p>
      </div>
    </div>
  );
}
