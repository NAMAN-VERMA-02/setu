import { COLLEAGUE_PRIOR_RANGE } from "./cross-edges";

type Person = { pid: string; node_id: string; story_key: string | null; role: string; public_company: string | null };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Alumni at the same public company but different colleges get a modest edge, so cross-college routes
 * exist beyond the story. At most two per person; story people are never touched. Deterministic.
 */
export function colleagueEdges(people: Person[]): { a: string; b: string; prior: number }[] {
  const byCompany = new Map<string, Person[]>();
  for (const p of people) {
    if (p.story_key || p.role !== "alum" || !p.public_company) continue;
    byCompany.set(p.public_company, [...(byCompany.get(p.public_company) ?? []), p]);
  }
  const used = new Map<string, number>();
  const out: { a: string; b: string; prior: number }[] = [];
  for (const group of byCompany.values()) {
    const sorted = [...group].sort((x, y) => hash(x.pid) - hash(y.pid));
    for (const x of sorted) {
      for (const y of sorted) {
        if (x.pid >= y.pid || x.node_id === y.node_id) continue;
        if ((used.get(x.pid) ?? 0) >= 2 || (used.get(y.pid) ?? 0) >= 2) continue;
        const { min, max } = COLLEAGUE_PRIOR_RANGE;
        const prior = Math.round((min + hash(x.pid + y.pid) * (max - min)) * 100) / 100;
        out.push({ a: x.pid, b: y.pid, prior }, { a: y.pid, b: x.pid, prior });
        used.set(x.pid, (used.get(x.pid) ?? 0) + 1);
        used.set(y.pid, (used.get(y.pid) ?? 0) + 1);
      }
    }
  }
  return out;
}
