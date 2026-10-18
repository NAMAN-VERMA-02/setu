"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/**
 * A header link with an unread count. It asks the server for the number once, then refreshes it
 * whenever a new row arrives in the given table (row security limits Realtime to my own rows).
 */
export function NavBadgeLink({ href, label, countUrl, table, className }: { href: string; label: string; countUrl: string; table: string; className: string }) {
  const [count, setCount] = useState(0);
  // The header renders this link twice (desktop and mobile nav); each needs its own channel.
  const instance = useId();

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(countUrl)
        .then((r) => (r.ok ? r.json() : null))
        .then((b) => alive && typeof b?.count === "number" && setCount(b.count))
        .catch(() => {});
    load();

    const supabase = createClient();
    const channel = supabase
      .channel(`badge-${table}-${instance}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table }, load)
      .subscribe();
    const poll = setInterval(load, 60_000);
    window.addEventListener("setu:badge-refresh", load);

    return () => {
      alive = false;
      clearInterval(poll);
      window.removeEventListener("setu:badge-refresh", load);
      supabase.removeChannel(channel);
    };
  }, [countUrl, table, instance]);

  return (
    <Link href={href} className={className}>
      {label}
      {count > 0 && (
        <span aria-label={`${count} unread`} className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--red-tile)] px-1.5 text-[11px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
