import { TRUST_LABELS, TRUST_STEPS, type TrustStep } from "@/lib/asks/trust";

/** The four rungs: a question, a call, a small task, a referral. */
export function TrustLadder({ step }: { step: TrustStep }) {
  const current = TRUST_STEPS.indexOf(step);
  return (
    <ol className="flex items-start gap-1" aria-label={`Trust step: ${TRUST_LABELS[step]}`}>
      {TRUST_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            <span className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done || active ? "bg-[var(--ink)]" : "bg-[var(--ink)]/15"}`} />
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                  active
                    ? "border-[var(--ink)] bg-[var(--yellow)] text-[var(--ink)]"
                    : done
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--ink)]/20 bg-white text-[var(--muted)]"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === TRUST_STEPS.length - 1 ? "opacity-0" : done ? "bg-[var(--ink)]" : "bg-[var(--ink)]/15"}`} />
            </span>
            <span className={`mt-1 text-[11px] leading-tight sm:text-xs ${active ? "font-bold" : "text-[var(--muted)]"}`}>
              {TRUST_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
