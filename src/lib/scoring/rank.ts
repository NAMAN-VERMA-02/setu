/** Maximum introduction chain: the student, one bridging senior, the target. */
export const MAX_HOPS = 2;

/** A company count is shown only when it cannot identify a single contact. */
export const MIN_COMPANY_COUNT = 2;

/** Most waiting requests a senior can hold at once. */
export const MAX_WAITING_PER_SENIOR = 3;

export const REACH = { direct: 1.0, viaOneSenior: 0.6 } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Recently active, or still owing help to juniors, means more likely to answer. */
export function responsiveness(lastActiveAt: Date | string, helpOwed: number, now: Date = new Date()): number {
  const last = new Date(lastActiveAt).getTime();
  const days = Number.isFinite(last) ? Math.max(0, (now.getTime() - last) / DAY_MS) : Infinity;
  const base = days <= 30 ? 1.0 : days <= 90 ? 0.8 : days <= 180 ? 0.6 : 0.4;
  return helpOwed > 0 ? Math.max(base, 0.9) : base;
}

/** Rank = match score x reach x responsiveness. */
export function rank(score: number, reach: number, responsive: number): number {
  return Math.round(score * reach * responsive * 100) / 100;
}
