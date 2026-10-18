import { describe, expect, it } from "vitest";
import { queryTokens, rankPeople, type PeopleSeeker, type PersonRow } from "./rank";

const NOW = new Date("2026-10-18T00:00:00Z");

const person = (id: string, over: Partial<PersonRow> = {}): PersonRow => ({
  id,
  fullName: `Person ${id}`,
  role: "alumni",
  batch: 2023,
  branch: "CSE",
  headline: null,
  bio: null,
  company: null,
  title: null,
  location: null,
  expertise: [],
  openTo: [],
  intents: [],
  lastActiveAt: "2026-10-10T00:00:00Z",
  helpOwed: 0,
  ...over,
});

const seeker: PeopleSeeker = { skills: ["react"], seekIntents: ["GATE preparation mentor"], goalCompany: "Cognizant" };

describe("queryTokens", () => {
  it("drops question filler and keeps topics", () => {
    expect(queryTokens("who can help me with GATE and a backlog")).toEqual(["gate", "backlog"]);
  });
});

describe("rankPeople with a question", () => {
  const people = [
    person("gate", { expertise: ["GATE", "DSA"], intents: [{ kind: "offer", category: "mentoring", statement: "GATE mentoring for CSE juniors" }], openTo: ["mentoring"] }),
    person("react", { expertise: ["React"] }),
    person("bio", { bio: "Cleared GATE in 2022" }),
  ];

  it("ranks real expertise and offers above a passing mention, and says why", () => {
    const r = rankPeople({ text: "who can help me with GATE" }, seeker, people, NOW);
    expect(r.map((p) => p.id)).toEqual(["gate", "bio"]);
    expect(r[0].reasons).toEqual(expect.arrayContaining(["Knows gate", "Offers: GATE mentoring for CSE juniors"]));
  });

  it("drops people who match nothing", () => {
    expect(rankPeople({ text: "quantum chemistry" }, seeker, people, NOW)).toEqual([]);
  });
});

describe("rankPeople filters and suggestions", () => {
  it("applies role, open-to and company filters", () => {
    const people = [
      person("a", { role: "recruiter", company: "Zoho", openTo: ["hiring"] }),
      person("b", { role: "alumni", company: "Zoho", openTo: ["mentoring"] }),
    ];
    expect(rankPeople({ text: "", role: "recruiter" }, seeker, people, NOW).map((p) => p.id)).toEqual(["a"]);
    expect(rankPeople({ text: "", openTo: "mentoring" }, seeker, people, NOW).map((p) => p.id)).toEqual(["b"]);
    expect(rankPeople({ text: "", company: "zoh" }, seeker, people, NOW)).toHaveLength(2);
    expect(rankPeople({ text: "", company: "infosys" }, seeker, people, NOW)).toHaveLength(0);
  });

  it("without a question, suggests people who fit the searcher", () => {
    const people = [
      person("far"),
      person("fit", { expertise: ["react"], company: "Cognizant", intents: [{ kind: "offer", category: "mentoring", statement: "GATE preparation help" }] }),
    ];
    const r = rankPeople({ text: "" }, seeker, people, NOW);
    expect(r[0].id).toBe("fit");
    expect(r[0].reasons).toEqual(expect.arrayContaining(["Works at Cognizant", "Shares your skills: react"]));
  });

  it("is deterministic on ties", () => {
    const r = rankPeople({ text: "" }, seeker, [person("b"), person("a")], NOW);
    expect(r.map((p) => p.fullName)).toEqual(["Person a", "Person b"]);
  });
});

describe("rankPeople with vouches", () => {
  it("lifts a vouched student and says so, capped so it cannot outweigh expertise", () => {
    const people = [
      person("plain", { role: "student", expertise: ["React"] }),
      person("vouched", { role: "student", expertise: ["React"], vouches: 2 }),
      person("many", { role: "student", expertise: ["React"], vouches: 9 }),
    ];
    const out = rankPeople({ text: "react" }, seeker, people, NOW);
    expect(out.map((p) => p.id)).toEqual(["many", "vouched", "plain"]);
    expect(out[1].reasons).toContain("Vouched for by 2 seniors");
    expect(out[0].score - out[2].score).toBe(12);
  });
});
