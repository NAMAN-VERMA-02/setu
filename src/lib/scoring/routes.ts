import { DECISION_LABELS } from "@/lib/validation/journey";

/** Groups smaller than this are folded away so no single person can be picked out. */
export const MIN_GROUP = 2;

export type Outcome = { decision: string | null; company: string | null };

export type RouteBranch = {
  decision: string;
  label: string;
  count: number;
  destinations: { label: string; count: number }[];
};

export type RouteMapData = { total: number; branches: RouteBranch[] };

const labelFor = (decision: string) =>
  (DECISION_LABELS as Record<string, string>)[decision] ?? "Something else";

/**
 * What the matched seniors did next: how many took each route, and where the
 * job and startup routes ended up. Counts only, never names.
 */
export function buildRouteMap(outcomes: Outcome[]): RouteMapData {
  const byDecision = new Map<string, Outcome[]>();
  for (const o of outcomes) {
    const key = o.decision ?? "other";
    byDecision.set(key, [...(byDecision.get(key) ?? []), o]);
  }

  const branches: RouteBranch[] = [];
  let folded = 0;
  for (const [decision, group] of byDecision) {
    if (decision !== "other" && group.length < MIN_GROUP) {
      folded += group.length;
      continue;
    }
    branches.push(toBranch(decision, group));
  }

  if (folded > 0) {
    const other = branches.find((b) => b.decision === "other");
    if (other) other.count += folded;
    else branches.push({ decision: "other", label: labelFor("other"), count: folded, destinations: [] });
  }

  branches.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { total: outcomes.length, branches };
}

function toBranch(decision: string, group: Outcome[]): RouteBranch {
  const counts = new Map<string, number>();
  for (const o of group) {
    const name = o.company?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const destinations: { label: string; count: number }[] = [];
  let rest = 0;
  for (const [label, count] of counts) {
    if (count >= MIN_GROUP) destinations.push({ label, count });
    else rest += count;
  }
  destinations.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (rest > 0) destinations.push({ label: "Other companies", count: rest });

  return { decision, label: labelFor(decision), count: group.length, destinations };
}
