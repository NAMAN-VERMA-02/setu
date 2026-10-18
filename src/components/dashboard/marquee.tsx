const WORDS = ["Their yesterday is your tomorrow", "Past-self matching", "Ask through someone they trust", "Pay it forward ×3", "सेतु"];

/** Slow looping ticker. Decorative, so it is hidden from screen readers. */
export function Marquee() {
  const row = WORDS.flatMap((w) => [w, "✦"]);
  return (
    <div className="overflow-hidden bg-[var(--ink)] py-3 text-[var(--paper)]" aria-hidden="true">
      <div className="marquee text-lg font-black uppercase tracking-tight sm:text-2xl">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-6 pr-6">
            {row.map((w, i) => (
              <span key={i} className={w === "✦" ? "text-[var(--yellow)]" : ""}>
                {w}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
