import type { Traits } from "./traits";

/** A row of public.snapshots as the matching code needs it. */
export type SnapshotRow = {
  user_id: string;
  semester: number;
  cgpa_range: string | null;
  backlog_count: number;
  tenth_range: string | null;
  twelfth_range: string | null;
  decision: string | null;
  show_cgpa: boolean;
  show_tenth: boolean;
  show_twelfth: boolean;
};

export const toTraits = (s: SnapshotRow, branch: string, tier: number): Traits => ({
  collegeTier: tier,
  cgpaRange: s.cgpa_range,
  branch,
  backlogCount: s.backlog_count,
  tenthRange: s.tenth_range,
  twelfthRange: s.twelfth_range,
  decision: s.decision,
});

/** Splits ids into groups small enough to keep `in (...)` URLs short. */
export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
