"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-16">
      <p className="mb-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--red)]">Something broke</p>
      <h1 className="text-[clamp(2.75rem,9vw,6rem)] font-black uppercase leading-[0.9] tracking-[-0.04em]">
        That did not <span className="accent">work.</span>
      </h1>
      <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">
        It is on us, not you. Try again, and if it keeps happening, go back to your dashboard.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} data-magnetic className="rounded-full bg-[var(--ink)] px-8 py-3.5 text-base font-bold text-white">
          Try again
        </button>
        <Link href="/dashboard" className="rounded-full border border-[var(--ink)] px-8 py-3.5 text-base font-bold">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
