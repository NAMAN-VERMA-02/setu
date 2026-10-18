import { describe, expect, it } from "vitest";
import { MAX_DRAFTS, checkDrafts, redact, sanitizeUntrusted, type AgentMatch } from "./guardrails";

const direct = { type: "direct" as const, hops: 1 as const, rank: 80 };
const via = { type: "via_senior" as const, hops: 2 as const, rank: 48, company: "Cognizant", contactCount: 3 };

const allowed = new Map<string, AgentMatch>([
  ["a", { id: "a", displayName: "Amit", firstLine: "You also had 1 backlog in semester 5.", routes: [direct, via] }],
  ["b", { id: "b", displayName: "Riya", firstLine: "You both aimed for a job.", routes: [direct] }],
  ["c", { id: "c", displayName: "Kabir", firstLine: "You are both from CSE.", routes: [direct] }],
  ["d", { id: "d", displayName: "Diya", firstLine: "You both had no backlogs.", routes: [direct] }],
]);

const ask = (over: Record<string, string> = {}) => ({
  match_id: "a",
  route: "direct",
  message: "How did you prepare for the online test?",
  why: "Shares a backlog",
  ...over,
});

describe("redact and sanitizeUntrusted", () => {
  it("removes emails, links and phone numbers", () => {
    const out = redact("mail me at a.b@kiet.edu or +91 98765 43210 or https://x.com/me");
    expect(out).not.toMatch(/@kiet|98765|x\.com/);
  });
  it("strips control characters, collapses spaces and truncates", () => {
    expect(sanitizeUntrusted("hi\u0000 there\n\n  you", 50)).toBe("hi there you");
    expect(sanitizeUntrusted("x".repeat(500), 10)).toHaveLength(10);
    expect(sanitizeUntrusted(null)).toBe("");
  });
});

describe("checkDrafts", () => {
  const run = (raw: ReturnType<typeof ask>[], bridgeBlocked = false) => checkDrafts(raw, allowed, { bridgeBlocked });

  it("accepts a good draft and opens with the shared trait", () => {
    const { accepted, rejected } = run([ask()]);
    expect(rejected).toEqual([]);
    expect(accepted[0].message.startsWith("You also had 1 backlog in semester 5.")).toBe(true);
    expect(accepted[0].route).toBe("direct");
  });

  it("does not repeat the opening line when the model already used it", () => {
    const { accepted } = run([ask({ message: "You also had 1 backlog in semester 5. How did you cope?" })]);
    expect(accepted[0].message.match(/You also had 1 backlog/g)).toHaveLength(1);
  });

  it("rejects matches the student does not have", () => {
    expect(run([ask({ match_id: "zzz" })]).rejected[0].reason).toMatch(/not one of your matches/);
  });

  it("rejects referral requests, contact details and extra questions", () => {
    expect(run([ask({ message: "Can you refer me to Cognizant?" })]).accepted).toEqual([]);
    expect(run([ask({ message: "Could you put in a word for me?" })]).accepted).toEqual([]);
    expect(run([ask({ message: "Mail me at me@kiet.edu, ok?" })]).accepted).toEqual([]);
    expect(run([ask({ message: "Why? How?" })]).accepted).toEqual([]);
    expect(run([ask({ message: "No question here." })]).accepted).toEqual([]);
  });

  it("rejects overlong drafts", () => {
    expect(run([ask({ message: "word ".repeat(200) + "?" })]).accepted).toEqual([]);
  });

  it("allows a bridge only when the senior has contacts and no bridge is open", () => {
    expect(run([ask({ route: "bridge" })]).accepted[0].targetCompany).toBe("Cognizant");
    expect(run([ask({ route: "bridge" })], true).accepted).toEqual([]);
    expect(run([ask({ match_id: "b", route: "bridge" })]).accepted).toEqual([]);
  });

  it("allows one draft per senior and at most three in total", () => {
    const twice = run([ask(), ask()]);
    expect(twice.accepted).toHaveLength(1);
    const many = run(["a", "b", "c", "d"].map((id) => ask({ match_id: id })));
    expect(many.accepted).toHaveLength(MAX_DRAFTS);
    expect(many.rejected).toHaveLength(1);
  });

  it("rejects unknown routes", () => {
    expect(run([ask({ route: "email" })]).accepted).toEqual([]);
  });
});
