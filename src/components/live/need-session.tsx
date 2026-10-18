"use client";

import Link from "next/link";
import { useSession, type SessionInfo, type ViewerTokens } from "@/lib/fed/client";

/** Renders children once a persona or joined profile exists; otherwise points to the picker. */
export function NeedSession({ children }: { children: (s: { session: SessionInfo; viewer: ViewerTokens; ledger: { points: number; karz: number; score: number }; refresh: () => void }) => React.ReactNode }) {
  const { loading, session, viewer, ledger, refresh } = useSession();
  if (loading) return <div className="h-40 animate-pulse rounded-[22px] bg-[var(--surface)]" role="status" aria-label="Loading" />;
  if (!session) {
    return (
      <div className="rounded-[22px] bg-[var(--surface)] p-8">
        <h2 className="text-3xl font-black">Pick who you are first</h2>
        <p className="mt-2 text-[var(--muted)]">Choose a demo persona, or join with your own profile.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/live" className="rounded-full bg-[var(--ink)] px-6 py-3 text-lg font-semibold text-white">
            Pick a persona
          </Link>
          <Link href="/join" className="rounded-full border border-[var(--ink)] px-6 py-3 text-lg font-semibold">
            Join as yourself
          </Link>
        </div>
      </div>
    );
  }
  return <>{children({ session, viewer, ledger, refresh })}</>;
}
