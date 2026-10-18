import { Marquee } from "@/components/dashboard/marquee";
import { LiveClock } from "@/components/fx/live-clock";

/** Ticker, small print and an oversized wordmark that rises into view. */
export function SiteFooter() {
  return (
    <>
      <Marquee />
      <footer className="overflow-hidden px-4 pt-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6">
          <p className="font-mono text-xs uppercase leading-relaxed tracking-wide">
            <span className="text-[var(--muted)]">Local time</span>
            <br />
            <LiveClock />
          </p>
          <p className="max-w-sm text-sm text-[var(--muted)]">
            SETU, your college’s own network. Marks are shown only as ranges, and only if you switch them on.
          </p>
          <a href="#top" data-magnetic className="inline-block rounded-full border border-[var(--ink)] px-5 py-2 font-mono text-xs font-bold uppercase tracking-wide">
            Back to top ↑
          </a>
        </div>
        <p className="footer-word reveal" aria-hidden="true">
          SETU
        </p>
      </footer>
    </>
  );
}
