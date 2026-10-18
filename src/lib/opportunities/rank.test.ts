import { describe, expect, it } from "vitest";
import { createOpportunitySchema, canPost } from "@/lib/validation/opportunities";
import { rankOpportunities, tokens, type OppRow, type Seeker } from "./rank";

const NOW = new Date("2026-10-18T00:00:00Z");

const seeker: Seeker = {
  skills: ["React", "SQL"],
  goalText: "SDE at Cognizant",
  goalCompany: "Cognizant",
  seekIntents: ["mentor for GATE preparation"],
};

const opp = (id: string, over: Partial<OppRow> = {}): OppRow => ({
  id,
  kind: "job",
  title: "Engineer",
  description: "Build things",
  company: null,
  skills: [],
  createdAt: "2026-10-01T00:00:00Z",
  deadline: null,
  ...over,
});

describe("tokens", () => {
  it("lowercases, drops short and filler words, and de-duplicates", () => {
    expect(tokens("The SQL and SQL for Cognizant!")).toEqual(["sql", "cognizant"]);
  });
});

describe("rankOpportunities", () => {
  it("puts skill and company matches first and explains why", () => {
    const ranked = rankOpportunities(
      seeker,
      [opp("plain"), opp("fit", { skills: ["react", "sql"], company: "Cognizant", title: "SDE intern" })],
      NOW,
    );
    expect(ranked[0].id).toBe("fit");
    expect(ranked[0].reasons).toEqual(expect.arrayContaining(["At your target company, Cognizant"]));
    expect(ranked[0].reasons.some((r) => r.startsWith("Uses your skills"))).toBe(true);
  });

  it("matches skills case-insensitively and caps the skill bonus", () => {
    const [r] = rankOpportunities(seeker, [opp("a", { skills: ["REACT", "Sql", "x1", "x2"] })], NOW);
    expect(r.score).toBeGreaterThanOrEqual(32);
  });

  it("uses looking-for intents", () => {
    const [r] = rankOpportunities(seeker, [opp("m", { kind: "mentorship", title: "GATE mentor circle", description: "Preparation help" })], NOW);
    expect(r.reasons).toContain("Fits what you are looking for");
  });

  it("drops expired opportunities and keeps today's deadline", () => {
    const ranked = rankOpportunities(seeker, [opp("old", { deadline: "2026-10-17" }), opp("today", { deadline: "2026-10-18" })], NOW);
    expect(ranked.map((r) => r.id)).toEqual(["today"]);
  });

  it("prefers newer posts when scores tie, deterministically", () => {
    const ranked = rankOpportunities(seeker, [opp("a", { createdAt: "2026-06-01T00:00:00Z" }), opp("b", { createdAt: "2026-06-02T00:00:00Z" })], NOW);
    expect(ranked.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("keeps the original fields", () => {
    const [r] = rankOpportunities(seeker, [opp("x", { title: "Hello there" })], NOW);
    expect(r.title).toBe("Hello there");
  });
});

describe("validation", () => {
  const ok = { kind: "job", title: "SDE intern", description: "Build", skills: ["react"] };
  it("accepts a normal post and rejects bad kinds and dates", () => {
    expect(createOpportunitySchema.safeParse(ok).success).toBe(true);
    expect(createOpportunitySchema.safeParse({ ...ok, kind: "scam" }).success).toBe(false);
    expect(createOpportunitySchema.safeParse({ ...ok, deadline: "tomorrow" }).success).toBe(false);
  });
  it("lets only the right roles post", () => {
    expect(canPost("recruiter")).toBe(true);
    expect(canPost("student")).toBe(false);
  });
});
