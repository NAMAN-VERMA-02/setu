import { describe, expect, it } from "vitest";
import { buildHistory, STORY_LEDGER, summarise, type DirPerson } from "./history";

const NOW = new Date("2026-10-18T10:00:00Z");

function people(): DirPerson[] {
  const out: DirPerson[] = [];
  for (const [i, k] of ["aman", "rohan", "priya", "arjun", "kavya", "sneha"].entries()) {
    out.push({ pid: `ngit_story${i}`, node_id: "ngit", role: k === "priya" || k === "arjun" || k === "kavya" ? "alum" : "student", story_key: k });
  }
  for (let i = 0; i < 40; i++) {
    out.push({ pid: `ngit_s${i}`, node_id: "ngit", role: i < 15 ? "student" : "alum", story_key: null });
    out.push({ pid: `rce_s${i}`, node_id: "rce", role: i < 15 ? "student" : "alum", story_key: null });
  }
  out.push({ pid: "ngit_pc", node_id: "ngit", role: "placement", story_key: "ngit_pc" });
  return out;
}

describe("demo history", () => {
  const h = buildHistory(people(), NOW);

  it("reads 142 intros, 68% acceptance and 9 hires for the last 7 days", () => {
    expect(summarise(h, NOW, 7)).toEqual({ intros: 142, acceptance: 68, hires: 9 });
  });

  it("has 14 days of activity and every intro flagged as history", () => {
    expect(h.intros).toHaveLength(260);
    expect(h.intros.every((i) => i.is_history)).toBe(true);
    const days = new Set(h.intros.map((i) => Math.floor((NOW.getTime() - new Date(i.created_at).getTime()) / 86_400_000)));
    expect(days.size).toBeGreaterThanOrEqual(14);
  });

  it("is deterministic", () => {
    expect(buildHistory(people(), NOW)).toEqual(h);
  });

  it("never uses story people in history intros or hops", () => {
    const story = new Set(people().filter((p) => p.story_key).map((p) => p.pid));
    expect(h.intros.some((i) => story.has(i.requester) || story.has(i.target))).toBe(false);
    expect(h.hops.some((x) => story.has(x.from_pid) || story.has(x.to_pid))).toBe(false);
  });

  it("gives the NGIT top 5 exactly as the slide: Arjun, Kavya, Priya, Rohan, Sneha", () => {
    const score = new Map<string, number>();
    for (const l of h.ledger) score.set(l.pid, (score.get(l.pid) ?? 0) + l.points - l.karz);
    const ngit = people().filter((p) => p.node_id === "ngit" && p.role !== "placement");
    const top = ngit.map((p) => ({ p, s: score.get(p.pid) ?? 0 })).sort((a, b) => b.s - a.s).slice(0, 5);
    expect(top.map((t) => t.p.story_key)).toEqual(["arjun", "kavya", "priya", "rohan", "sneha"]);
    expect(top.map((t) => t.s)).toEqual([2310, 1875, 1240, 965, 570]);
    expect(STORY_LEDGER.aman).toEqual({ points: 40, karz: 140 });
  });
});
