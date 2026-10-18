import { describe, expect, it } from "vitest";
import { pickJuniors, type JuniorInput } from "./payforward";
import type { Traits } from "./traits";

const helperThen: Traits = {
  collegeTier: 2,
  cgpaRange: "6.5-7",
  branch: "CSE",
  backlogCount: 1,
  tenthRange: "65-70",
  twelfthRange: "70-75",
  decision: "job",
};
const helper = { 5: helperThen };
const hidden = { cgpa: false, tenth: false, twelfth: false };

function junior(id: string, over: Partial<Traits> = {}, extra: Partial<JuniorInput> = {}): JuniorInput {
  return {
    id,
    displayName: id,
    batch: 2027,
    branch: "CSE",
    goalTarget: "SDE at Cognizant",
    question: "How did you prepare?",
    semester: 5,
    traits: { ...helperThen, ...over },
    visibility: { cgpa: true, tenth: true, twelfth: true },
    ...extra,
  };
}

describe("pickJuniors", () => {
  it("returns the three closest juniors, best first", () => {
    const picks = pickJuniors(helper, [
      junior("far", { cgpaRange: "9-9.5", backlogCount: 0, decision: "gate" }),
      junior("close"),
      junior("mid", { cgpaRange: "9-9.5" }),
      junior("mid2", { backlogCount: 0 }),
    ]);
    expect(picks).toHaveLength(3);
    expect(picks[0].id).toBe("close");
    expect(picks.map((p) => p.score)).toEqual([...picks.map((p) => p.score)].sort((a, b) => b - a));
  });

  it("compares each junior with the helper's own snapshot from that junior's semester", () => {
    const picks = pickJuniors(helper, [junior("sem3", {}, { semester: 3 })]);
    expect(picks).toEqual([]);
  });

  it("skips juniors who only share the college tier", () => {
    const stranger = junior("x", { cgpaRange: "9-9.5", branch: "MECH", backlogCount: 0, tenthRange: "90-95", twelfthRange: "90-95", decision: "gate" });
    expect(pickJuniors(helper, [stranger])).toEqual([]);
  });

  it("never mentions marks the junior kept private", () => {
    const [p] = pickJuniors(helper, [junior("h", {}, { visibility: hidden })]);
    expect(p.sharedTraits).not.toContain("cgpa");
    expect(p.firstLine).not.toMatch(/CGPA|10th|12th/);
    expect(p.score).toBe(100);
  });

  it("is deterministic on ties and respects the limit", () => {
    const picks = pickJuniors(helper, [junior("c"), junior("a"), junior("b")], 2);
    expect(picks.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
