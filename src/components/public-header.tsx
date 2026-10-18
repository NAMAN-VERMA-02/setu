import Link from "next/link";
import { ThemeToggle } from "@/components/fx/theme-toggle";

/** Floating header for pages that do not need a signed-in user. */
export function PublicHeader({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="header-drop sticky top-0 z-10 mx-auto w-full max-w-6xl px-3 sm:px-6">
      <div className="flex items-center justify-between gap-4 rounded-b-[22px] bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(15,15,14,.08),0_16px_36px_-24px_rgba(15,15,14,.3)] sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 font-black uppercase leading-none tracking-tight" aria-label="SETU home">
          <span className="text-3xl">SETU</span>
          <span className="text-sm font-medium normal-case text-[var(--muted)]">सेतु</span>
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <ThemeToggle />
          {!minimal && (<>
          <Link href="/live" className="hidden rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--paper)] sm:inline-block">
            Live Network
          </Link>
          <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--paper)]">
            Log in
          </Link>
          <Link href="/signup" data-magnetic className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
            Join SETU
          </Link>
          </>)}
        </nav>
      </div>
    </header>
  );
}
