import { describe, expect, it } from "vitest";
import { OPEN_TO, parseExpertise, profileSchema, roleExtras } from "@/lib/validation/profile";
import { profileCompleteness, type ProfileFacts } from "./completeness";

const empty: ProfileFacts = {
  role: "student",
  headline: null,
  bio: null,
  location: null,
  current_company: null,
  current_title: null,
  expertise: [],
  open_to: [],
  details: {},
  intents: 0,
};

describe("profileCompleteness", () => {
  it("starts at zero and lists what to add", () => {
    const c = profileCompleteness(empty);
    expect(c.percent).toBe(0);
    expect(c.missing[0]).toBe("a headline");
  });
  it("reaches 100 when everything for the role is filled", () => {
    const full: ProfileFacts = {
      ...empty,
      headline: "SDE at Zoho",
      bio: "Hi",
      location: "Noida",
      expertise: ["react", "sql", "dsa"],
      open_to: ["mentoring"],
      intents: 1,
    };
    expect(profileCompleteness(full).percent).toBe(100);
  });
  it("asks founders and recruiters for their own extras", () => {
    const base = { ...empty, headline: "x", bio: "x", location: "x", expertise: ["a", "b", "c"], open_to: ["hiring"], intents: 1 };
    expect(profileCompleteness({ ...base, role: "founder" }).missing).toEqual(["your company", "your stage", "the problems you are solving"]);
    expect(profileCompleteness({ ...base, role: "recruiter" }).missing).toEqual(["your company", "who you are hiring"]);
    expect(profileCompleteness({ ...base, role: "faculty" }).missing).toEqual(["your lab or department"]);
  });
});

describe("profile validation", () => {
  const ok = { headline: "h", bio: "b", location: "l", currentCompany: "", currentTitle: "", expertise: ["react"], openTo: ["mentoring"], intents: [] };
  it("accepts a valid profile", () => {
    expect(profileSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects unknown open-to values, long headlines and too many intents", () => {
    expect(profileSchema.safeParse({ ...ok, openTo: ["spamming"] }).success).toBe(false);
    expect(profileSchema.safeParse({ ...ok, headline: "x".repeat(141) }).success).toBe(false);
    const intent = { kind: "seek", category: "career", statement: "SDE at Cognizant" };
    expect(profileSchema.safeParse({ ...ok, intents: Array(6).fill(intent) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...ok, intents: [{ ...intent, statement: "hi" }] }).success).toBe(false);
  });
  it("knows which extras each role sees", () => {
    expect(roleExtras("student")).toEqual([]);
    expect(roleExtras("founder")).toContain("stage");
    expect(OPEN_TO).toContain("hiring");
  });
  it("splits expertise into clean tags", () => {
    expect(parseExpertise(" React, sql,React ,, DSA ")).toEqual(["React", "sql", "DSA"]);
  });
});
