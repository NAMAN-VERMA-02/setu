import { describe, expect, it } from "vitest";
import {
  MAX_WAITING_PER_SENIOR,
  TRAIT_POINTS,
  computeRarity,
  matchSeniors,
  rangeMid,
  rank,
  rarestTrait,
  rarityBonus,
  responsiveness,
  scoreTraits,
  traitMatches,
  type Candidate,
  type Traits,
} from "./index";

const me: Traits = {
  collegeTier: 3,
  cgpaRange: "6.5-7",
  branch: "CSE",
  backlogCount: 1,
  tenthRange: "65-70",
  twelfthRange: "70-75",
  decision: "job",
};

const NOW = new Date("2026-10-17T00:00:00Z");
const visibleAll = { cgpa: true, tenth: true, twelfth: true };

function cand(id: string, traits: Partial<Traits>, extra: Partial<Candidate> = {}): Candidate {
  return {
    id,
    displayName: id,
    batch: 2024,
    branch: traits.branch ?? me.branch,
    traits: { ...me, ...traits },
    visibility: visibleAll,
    lastActiveAt: NOW,
    helpOwed: 0,
    contacts: null,
    pendingAsks: 0,
    ...extra,
  };
}

describe("trait points", () => {
  it("add up to 100", () => {
    expect(Object.values(TRAIT_POINTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("rangeMid", () => {
  it("reads ranges and rejects junk", () => {
    expect(rangeMid("6.5-7")).toBe(6.75);
    expect(rangeMid("65-70")).toBe(67.5);
    expect(rangeMid("7-6")).toBeNull();
    expect(rangeMid("abc")).toBeNull();
    expect(rangeMid(null)).toBeNull();
  });
});

describe("traitMatches", () => {
  it("treats CGPA buckets within 0.5 as a match, but not two buckets apart", () => {
    expect(traitMatches("cgpa", me, { ...me, cgpaRange: "7-7.5" })).toBe(true);
    expect(traitMatches("cgpa", me, { ...me, cgpaRange: "6-6.5" })).toBe(true);
    expect(traitMatches("cgpa", me, { ...me, cgpaRange: "7.5-8" })).toBe(false);
  });
  it("treats 10th/12th buckets within 5% as a match", () => {
    expect(traitMatches("tenth", me, { ...me, tenthRange: "70-75" })).toBe(true);
    expect(traitMatches("tenth", me, { ...me, tenthRange: "75-80" })).toBe(false);
    expect(traitMatches("twelfth", me, { ...me, twelfthRange: "65-70" })).toBe(true);
  });
  it("never matches a missing mark or decision", () => {
    expect(traitMatches("cgpa", me, { ...me, cgpaRange: null })).toBe(false);
    expect(traitMatches("decision", { ...me, decision: null }, { ...me, decision: null })).toBe(false);
  });
  it("compares branch case-insensitively and backlogs exactly", () => {
    expect(traitMatches("branch", me, { ...me, branch: " cse " })).toBe(true);
    expect(traitMatches("backlogs", me, { ...me, backlogCount: 2 })).toBe(false);
  });
});

describe("scoreTraits", () => {
  it("gives 100 for an identical profile", () => {
    expect(scoreTraits(me, me).score).toBe(100);
  });
  it("sums only matching traits", () => {
    const r = scoreTraits(me, { ...me, cgpaRange: "9-9.5", backlogCount: 0, decision: "gate" });
    expect(r.score).toBe(20 + 15 + 10 + 10);
    expect(r.matched).toEqual(["tier", "branch", "tenth", "twelfth"]);
  });
});

describe("rarity", () => {
  const pool = [
    { ...me },
    { ...me, backlogCount: 0 },
    { ...me, backlogCount: 0 },
    { ...me, backlogCount: 0 },
  ];
  it("is high for traits few share and zero for universal ones", () => {
    const r = computeRarity(me, pool);
    expect(r.backlogs).toBe(0.75);
    expect(r.branch).toBe(0);
  });
  it("is 0 for an empty pool", () => {
    expect(computeRarity(me, []).backlogs).toBe(0);
  });
  it("bonus grows with rarity", () => {
    const r = computeRarity(me, pool);
    expect(rarityBonus(["backlogs"], r)).toBe(Math.round(15 * 0.5 * 0.75 * 100) / 100);
    expect(rarityBonus(["branch"], r)).toBe(0);
  });
  it("picks the rarest mentionable trait, ignoring tier and hidden marks", () => {
    const rarity = { tier: 0.99, cgpa: 0.9, branch: 0.1, backlogs: 0.5, tenth: 0.2, twelfth: 0.2, decision: 0.3 };
    const all = ["tier", "cgpa", "branch", "backlogs"] as const;
    expect(rarestTrait([...all], rarity, () => true)).toBe("cgpa");
    expect(rarestTrait([...all], rarity, (k) => k !== "cgpa")).toBe("backlogs");
    expect(rarestTrait(["tier"], rarity, () => true)).toBeNull();
  });
});

describe("responsiveness and rank", () => {
  it("decays with inactivity and is lifted by owing help", () => {
    expect(responsiveness("2026-10-10T00:00:00Z", 0, NOW)).toBe(1);
    expect(responsiveness("2026-08-01T00:00:00Z", 0, NOW)).toBe(0.8);
    expect(responsiveness("2025-01-01T00:00:00Z", 0, NOW)).toBe(0.4);
    expect(responsiveness("2025-01-01T00:00:00Z", 2, NOW)).toBe(0.9);
    expect(responsiveness("not a date", 0, NOW)).toBe(0.4);
  });
  it("multiplies score, reach and responsiveness", () => {
    expect(rank(80, 0.6, 0.5)).toBe(24);
  });
});

describe("matchSeniors", () => {
  it("ranks a closer match above a weaker one", () => {
    const res = matchSeniors(me, [cand("weak", { cgpaRange: "9-9.5", backlogCount: 0, decision: "gate" }), cand("strong", {})], {
      semester: 3,
      now: NOW,
    });
    expect(res.map((m) => m.id)).toEqual(["strong", "weak"]);
  });

  it("excludes candidates who only share the college tier", () => {
    const stranger = cand("x", { cgpaRange: "9-9.5", branch: "MECH", backlogCount: 0, tenthRange: "90-95", twelfthRange: "90-95", decision: "gate" });
    expect(matchSeniors(me, [stranger], { semester: 3, now: NOW })).toEqual([]);
  });

  it("excludes seniors who already have the maximum waiting requests", () => {
    const busy = cand("busy", {}, { pendingAsks: MAX_WAITING_PER_SENIOR });
    const ok = cand("ok", {}, { pendingAsks: MAX_WAITING_PER_SENIOR - 1 });
    expect(matchSeniors(me, [busy, ok], { semester: 3, now: NOW }).map((m) => m.id)).toEqual(["ok"]);
  });

  it("adds a 0.6-reach bridge route only when the contact count is at least 2", () => {
    const bridge = cand("amit", {}, { contacts: { company: "Cognizant", count: 3 } });
    const single = cand("solo", {}, { contacts: { company: "Cognizant", count: 1 } });
    const [a, s] = ["amit", "solo"].map((id) =>
      matchSeniors(me, [bridge, single], { semester: 3, now: NOW }).find((m) => m.id === id)!,
    );
    expect(a.routes.map((r) => r.type)).toEqual(["direct", "via_senior"]);
    const via = a.routes[1];
    expect(via.hops).toBe(2);
    expect(via.rank).toBeCloseTo(a.routes[0].rank * 0.6, 1);
    expect(s.routes.map((r) => r.type)).toEqual(["direct"]);
  });

  it("never lists hidden marks as shared, but still counts them in the score", () => {
    const hidden = cand("h", {}, { visibility: { cgpa: false, tenth: false, twelfth: false } });
    const [m] = matchSeniors(me, [hidden], { semester: 3, now: NOW });
    expect(m.score).toBe(100);
    expect(m.sharedTraits).not.toContain("cgpa");
    expect(m.sharedTraits).not.toContain("tenth");
    expect(m.sharedTraits).toContain("backlogs");
    expect(m.firstLine).not.toMatch(/CGPA|10th|12th/);
  });

  it("opens with the rarest shared trait", () => {
    const pool = [
      cand("a", {}),
      cand("b", { backlogCount: 0 }),
      cand("c", { backlogCount: 0 }),
      cand("d", { backlogCount: 0 }),
    ];
    const a = matchSeniors(me, pool, { semester: 3, now: NOW }).find((m) => m.id === "a")!;
    expect(a.firstLine).toBe("You also had 1 backlog in semester 3.");
    expect(a.rarityBonus).toBeGreaterThan(0);
  });

  it("respects the limit and is deterministic on ties", () => {
    const pool = ["c", "a", "b"].map((id) => cand(id, {}));
    const res = matchSeniors(me, pool, { semester: 3, now: NOW, limit: 2 });
    expect(res.map((m) => m.id)).toEqual(["a", "b"]);
  });
});
