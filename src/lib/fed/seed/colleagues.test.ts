import { describe, expect, it } from "vitest";
import { colleagueEdges } from "./colleagues";

const mk = (pid: string, node: string, company: string | null, story: string | null = null) => ({
  pid, node_id: node, story_key: story, role: "alum", public_company: company,
});

describe("colleague edges", () => {
  const people = [
    mk("ngit_1", "ngit", "FinStack"), mk("ngit_2", "ngit", "FinStack"), mk("ngit_3", "ngit", "FinStack"),
    mk("rce_1", "rce", "FinStack"), mk("rce_2", "rce", "FinStack"),
    mk("rce_3", "rce", "Nimbus Labs"), mk("ngit_4", "ngit", "Nimbus Labs"),
    mk("ngit_priya", "ngit", "FinStack", "priya"), mk("rce_meera", "rce", "FinStack", "meera"),
  ];
  const edges = colleagueEdges(people);

  it("links only different colleges, in both directions, with priors in range", () => {
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) {
      expect(e.a.split("_")[0]).not.toBe(e.b.split("_")[0]);
      expect(e.prior).toBeGreaterThanOrEqual(0.45);
      expect(e.prior).toBeLessThanOrEqual(0.65);
      expect(edges.some((x) => x.a === e.b && x.b === e.a && x.prior === e.prior)).toBe(true);
    }
  });

  it("never touches story people and caps two per person", () => {
    expect(edges.some((e) => /priya|meera/.test(e.a + e.b))).toBe(false);
    const count = new Map<string, number>();
    for (const e of edges) count.set(e.a, (count.get(e.a) ?? 0) + 1);
    expect(Math.max(...count.values())).toBeLessThanOrEqual(2);
  });

  it("is deterministic", () => {
    expect(colleagueEdges(people)).toEqual(edges);
  });
});
