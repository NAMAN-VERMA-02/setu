import { describe, expect, it } from "vitest";
import { dedupeCards, extractCards, planOffline, templateAnswer } from "./ask-core";

describe("offline router", () => {
  it("routes the scripted Hinglish question to find_helpers for fintech companies", () => {
    const calls = planOffline("NGIT ke kaunse alumni fintech ML mein madad kar sakte hain?");
    expect(calls.every((c) => c.tool === "find_helpers")).toBe(true);
    expect(calls.map((c) => c.args.company)).toEqual(["FinStack", "KoshaPay"]);
  });
  it("routes counts to college_stats", () => {
    expect(planOffline("how many alumni do you have?")[0].tool).toBe("college_stats");
    expect(planOffline("kitne log hain")[0].tool).toBe("college_stats");
  });
  it("uses a branch and goal when there is no company", () => {
    const [c] = planOffline("any ECE seniors who went into ML?");
    expect(c).toEqual({ tool: "find_helpers", args: { field: "ECE", goal: "ML engineer", limit: 5 } });
  });
  it("falls back to stats when nothing matches", () => {
    expect(planOffline("hello")).toEqual([{ tool: "college_stats", args: {} }]);
  });
});

describe("professional needs", () => {
  it("routes a plain-words need in any profession to match_need on every server", () => {
    for (const q of ["I am a doctor and I need a developer for a patient app", "mujhe ek designer chahiye", "looking for a startup lawyer"]) {
      const calls = planOffline(q);
      expect(calls).toHaveLength(1);
      expect(calls[0].tool).toBe("match_need");
      expect(calls[0].args.need).toBe(q);
    }
  });
  it("keeps company questions on find_helpers", () => {
    expect(planOffline("NGIT ke kaunse alumni fintech ML mein madad kar sakte hain?").every((c) => c.tool === "find_helpers")).toBe(true);
  });
  it("turns match_need results into cards and labels professionals as such", () => {
    const people = { college: "pro", people: [{ pid: "pro_aaaaaaaaaaaa", score: 0.91, title: "Full-stack & ML Developer", company: "Pulse Digital", grad_year: null }] };
    const cards = extractCards("pro", people);
    expect(cards[0]).toMatchObject({ pid: "pro_aaaaaaaaaaaa", title: "Full-stack & ML Developer", node: "pro" });
    expect(templateAnswer(cards, {}, [])).toContain("Professional · Full-stack & ML Developer, Pulse Digital");
  });
});

describe("cards and answer", () => {
  const helpers = { college: "ngit", helpers: [{ pid: "ngit_a", branch: "ECE", grad_year: 2022, title: "ML Engineer", company: "FinStack" }] };
  const matches = { college: "rce", matches: [{ pid: "rce_b", score: 0.9, now_title: "Data Scientist", now_company: "FinStack", outcome: "job" }] };

  it("extracts cards from both result shapes", () => {
    expect(extractCards("ngit", helpers)[0]).toMatchObject({ pid: "ngit_a", title: "ML Engineer", gradYear: 2022 });
    expect(extractCards("rce", matches)[0]).toMatchObject({ pid: "rce_b", company: "FinStack", score: 0.9 });
    expect(extractCards("rce", null)).toEqual([]);
  });
  it("dedupes by pid", () => {
    const c = extractCards("ngit", helpers);
    expect(dedupeCards([...c, ...c])).toHaveLength(1);
  });
  it("writes an offline answer with no names and mentions offline colleges", () => {
    const text = templateAnswer([...extractCards("ngit", helpers), ...extractCards("rce", matches)], {}, ["rce"]);
    expect(text).toContain("NGIT alum ’22 · ML Engineer, FinStack");
    expect(text).toContain("RCE is offline");
  });
});
