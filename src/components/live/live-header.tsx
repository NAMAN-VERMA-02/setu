"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/fx/theme-toggle";
import { COLLEGE_COLOUR, useNodeHealth, useSession } from "@/lib/fed/client";

const NAV = [
  { href: "/live", label: "Home" },
  { href: "/live/mirror", label: "Mirror" },
  { href: "/live/find", label: "Find" },
  { href: "/live/bridge", label: "Bridge" },
  { href: "/live/leaderboard", label: "Leaderboard" },
  { href: "/live/ask", label: "Ask Setu" },
  { href: "/live/privacy", label: "Privacy" },
  { href: "/live/me", label: "Me" },
];

const STATUS_COLOUR: Record<string, string> = { online: "#22c55e", offline: "#ef4444", revoked: "#ef4444", unknown: "#a1a1aa" };

export function NodePill({ id, status, label }: { id: string; status: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ink)]/15 bg-[var(--surface)] px-3 py-1 text-sm font-bold">
      <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOUR[status] ?? STATUS_COLOUR.unknown }} />
      <span style={{ color: COLLEGE_COLOUR[id] }}>{label ?? (id === "pro" ? "PROS" : id.toUpperCase())}</span>
    </span>
  );
}

/** Header for the Live Network: node lights, persona chip and navigation. */
export function LiveHeader() {
  const pathname = usePathname();
  const { nodes } = useNodeHealth();
  const { session } = useSession();
  const hub = nodes.length ? "online" : "unknown";

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--ink)]/10 bg-[var(--paper)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/live" className="flex items-baseline gap-2 font-black uppercase leading-none tracking-tight">
          <span className="text-3xl">SETU</span>
          <span className="text-sm font-semibold normal-case text-[var(--muted)]">Live Network</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2" aria-label="Server status">
          {(nodes.length ? nodes : [{ id: "ngit", status: "unknown" }, { id: "rce", status: "unknown" }, { id: "pro", status: "unknown" }]).map((n) => (
            <NodePill key={n.id} id={n.id} status={n.status} />
          ))}
          <NodePill id="hub" status={hub} label="HUB" />
          {session && (
            <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-sm font-semibold text-white" title={session.demoPersona ? "Demo persona" : "You"}>
              {session.demoPersona ? "Demo persona · " : ""}
              {session.label}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Live Network" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
        {NAV.map((l) => {
          const active = l.href === "/live" ? pathname === "/live" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-base font-semibold ${active ? "bg-[var(--ink)] text-white" : "hover:bg-[var(--surface)]"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
