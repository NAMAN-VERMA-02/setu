export const TRAIT_KEYS = ["tier", "cgpa", "branch", "backlogs", "tenth", "twelfth", "decision"] as const;
export type TraitKey = (typeof TRAIT_KEYS)[number];

/** Points per matching trait; they add up to 100. */
export const TRAIT_POINTS: Record<TraitKey, number> = {
  tier: 20,
  cgpa: 20,
  branch: 15,
  backlogs: 15,
  tenth: 10,
  twelfth: 10,
  decision: 10,
};

export const CGPA_TOLERANCE = 0.5;
export const PERCENT_TOLERANCE = 5;

/** One person's state in one semester. Marks are ranges like "6.5-7" or "65-70". */
export type Traits = {
  collegeTier: number;
  cgpaRange: string | null;
  branch: string;
  backlogCount: number;
  tenthRange: string | null;
  twelfthRange: string | null;
  decision: string | null;
};

/** Which mark ranges their owner agreed to show to others. */
export type Visibility = { cgpa: boolean; tenth: boolean; twelfth: boolean };

/** Midpoint of a "lo-hi" range, or null when it cannot be read. */
export function rangeMid(range: string | null): number | null {
  if (!range) return null;
  const m = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(range);
  if (!m) return null;
  const [lo, hi] = [Number(m[1]), Number(m[2])];
  return hi >= lo ? (lo + hi) / 2 : null;
}

function within(a: string | null, b: string | null, tolerance: number): boolean {
  const [x, y] = [rangeMid(a), rangeMid(b)];
  // Adjacent buckets are exactly one bucket-width apart, so compare with a small epsilon.
  return x !== null && y !== null && Math.abs(x - y) <= tolerance + 1e-9;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Does `other` match `me` on this trait? */
export function traitMatches(key: TraitKey, me: Traits, other: Traits): boolean {
  switch (key) {
    case "tier":
      return me.collegeTier === other.collegeTier;
    case "cgpa":
      return within(me.cgpaRange, other.cgpaRange, CGPA_TOLERANCE);
    case "branch":
      return same(me.branch, other.branch);
    case "backlogs":
      return me.backlogCount === other.backlogCount;
    case "tenth":
      return within(me.tenthRange, other.tenthRange, PERCENT_TOLERANCE);
    case "twelfth":
      return within(me.twelfthRange, other.twelfthRange, PERCENT_TOLERANCE);
    case "decision":
      return me.decision !== null && me.decision === other.decision;
  }
}

/** Traits shared with `other`, and the base score out of 100. */
export function scoreTraits(me: Traits, other: Traits): { score: number; matched: TraitKey[] } {
  const matched = TRAIT_KEYS.filter((k) => traitMatches(k, me, other));
  return { score: matched.reduce((sum, k) => sum + TRAIT_POINTS[k], 0), matched };
}

/** Marks are only discussed when their owner opted in; everything else is always shareable. */
export function isVisible(key: TraitKey, visibility: Visibility): boolean {
  if (key === "cgpa") return visibility.cgpa;
  if (key === "tenth") return visibility.tenth;
  if (key === "twelfth") return visibility.twelfth;
  return true;
}
