import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "@/components/fx/theme-toggle";
import { LiveRefresh } from "@/components/live-refresh";
import { NavBadgeLink } from "@/components/nav-badge-link";

type NavLink = { href: string; label: string; badge?: { countUrl: string; table: string } };

/** Everyone gets the network pages; roles add the tools that belong to them. */
function linksFor(role: string): NavLink[] {
  const base: NavLink[] = [
    { href: "/people", label: "People" },
    { href: "/opportunities", label: "Opportunities" },
    { href: "/network", label: "Network" },
    { href: "/messages", label: "Messages", badge: { countUrl: "/api/messages/unread", table: "messages" } },
    { href: "/notifications", label: "Updates", badge: { countUrl: "/api/notifications/unread", table: "notifications" } },
  ];
  const own: NavLink[] =
    role === "student"
      ? [{ href: "/matches", label: "Matches" }, { href: "/requests", label: "Requests" }]
      : role === "alumni"
        ? [{ href: "/requests", label: "Requests" }, { href: "/invites", label: "Invites" }]
        : role === "placement"
          ? [{ href: "/college", label: "College" }, { href: "/invites", label: "Invites" }]
          : role === "faculty"
            ? [{ href: "/invites", label: "Invites" }]
            : [];
  return [...base, ...own, { href: "/profile", label: "Profile" }];
}

/** Floating white header card shared by signed-in pages. */
export function AppHeader({ role = "student" }: { role?: string }) {
  const links = linksFor(role);

  return (
    <header className="header-drop sticky top-0 z-10 mx-auto w-full max-w-6xl px-3 sm:px-6">
      <div className="flex items-center justify-between gap-4 rounded-b-[22px] bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(15,15,14,.08),0_16px_36px_-24px_rgba(15,15,14,.3)] sm:px-6">
        <Link href="/dashboard" className="flex items-baseline gap-2 font-black uppercase leading-none tracking-tight" aria-label="SETU home">
          <span className="text-3xl">SETU</span>
          <span className="text-sm font-medium normal-case text-[var(--muted)]">सेतु</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            l.badge ? (
              <NavBadgeLink key={l.href} href={l.href} label={l.label} {...l.badge} className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--paper)]" />
            ) : (
              <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--paper)]">
                {l.label}
              </Link>
            )
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LiveRefresh />
          <ThemeToggle />
          <form action={signOut}>
            <button type="submit" className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
              Log out
            </button>
          </form>
        </div>
      </div>

      <nav aria-label="Main" className="flex gap-2 overflow-x-auto px-1 py-3 md:hidden">
        {links.map((l) => (
          l.badge ? (
            <NavBadgeLink key={l.href} href={l.href} label={l.label} {...l.badge} className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-medium shadow-[0_0_0_1px_rgba(15,15,14,.08)]" />
          ) : (
            <Link key={l.href} href={l.href} className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-medium shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
              {l.label}
            </Link>
          )
        ))}
      </nav>
    </header>
  );
}
