"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LIVE_EVENT } from "@/lib/live/use-live";
import { createClient } from "@/lib/supabase/client";

/** Which tables each screen shows. Row security limits every change to rows I may read. */
const WATCH: { match: (p: string) => boolean; tables: string[] }[] = [
  { match: (p) => p === "/dashboard", tables: ["asks", "connections", "opportunities", "opportunity_interests", "vouches", "helps"] },
  { match: (p) => p.startsWith("/requests") || p.startsWith("/matches") || p.startsWith("/payitforward"), tables: ["asks", "helps"] },
  { match: (p) => p.startsWith("/network"), tables: ["connections"] },
  { match: (p) => p.startsWith("/opportunities"), tables: ["opportunities", "opportunity_interests"] },
  { match: (p) => p.startsWith("/people"), tables: ["connections", "vouches"] },
  { match: (p) => p.startsWith("/notifications"), tables: ["notifications"] },
  { match: (p) => p.startsWith("/announcements") || p.startsWith("/college"), tables: ["announcements", "opportunities", "connections"] },
];

/**
 * Keeps the server-rendered screen current: when a row I can see changes, the page data is
 * re-fetched in place (no reload, scroll and typing are kept). Shows a small "Live" pill.
 */
export function LiveRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const instance = useId();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tables = WATCH.find((w) => w.match(pathname))?.tables;
  const key = tables?.join(",") ?? "";

  useEffect(() => {
    if (!key) return;
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      // Several writes often land together (a trigger plus the row itself); refresh once.
      timer.current = setTimeout(() => {
        router.refresh(); // server-rendered pages
        window.dispatchEvent(new Event(LIVE_EVENT)); // screens that fetch on the client
        window.dispatchEvent(new Event("setu:badge-refresh"));
      }, 350);
    };

    let channel = supabase.channel(`live-${instance}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      if (timer.current) clearTimeout(timer.current);
      setLive(false);
      supabase.removeChannel(channel);
    };
  }, [key, instance, router]);

  if (!key) return null;
  return (
    <span
      role="status"
      aria-label={live ? "Live updates on" : "Connecting to live updates"}
      title={live ? "Live: this page updates as things happen" : "Connecting…"}
      className="live-pill hidden items-center gap-1.5 rounded-full border border-[var(--ink)]/15 px-2.5 py-1 text-xs font-semibold sm:inline-flex"
      data-on={live ? "" : undefined}
    >
      <span className="live-dot" />
      Live
    </span>
  );
}
