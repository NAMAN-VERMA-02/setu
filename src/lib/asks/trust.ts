export const TRUST_STEPS = ["question", "call", "task", "referral"] as const;
export type TrustStep = (typeof TRUST_STEPS)[number];

export const TRUST_LABELS: Record<TrustStep, string> = {
  question: "A question",
  call: "A 15-minute call",
  task: "A small task",
  referral: "A referral",
};

/** Steps unlock one at a time; there is nothing after a referral. */
export function nextStep(step: TrustStep): TrustStep | null {
  const i = TRUST_STEPS.indexOf(step);
  return i >= 0 && i < TRUST_STEPS.length - 1 ? TRUST_STEPS[i + 1] : null;
}

/** A referral unlocks only after the senior has seen the student's work. */
export function canAdvance(step: TrustStep, workSeen: boolean): boolean {
  const next = nextStep(step);
  if (!next) return false;
  return next !== "referral" || workSeen;
}

/** Forward links and asks live for 7 days from creation. */
export const ASK_LIFETIME_DAYS = 7;

export function isExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** Whole days left before a request expires; 0 once it has. */
export function daysLeft(expiresAt: string | Date, now: Date = new Date()): number {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}
