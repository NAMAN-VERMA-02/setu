import { describe, expect, it } from "vitest";
import { checklist, firstName, formatBranch, nextStep, type DashboardState } from "./next-step";

const base: DashboardState = { role: "student", semesters: 3, sent: 0, climbed: false, waitingOnMe: 0, succeeded: false, helpOwed: 0 };

describe("nextStep", () => {
  it("starts with the journey", () => {
    expect(nextStep({ ...base, semesters: 0 }).href).toBe("/onboarding");
  });
  it("puts people waiting on you first", () => {
    const s = nextStep({ ...base, waitingOnMe: 2, sent: 1 });
    expect(s.href).toBe("/requests");
    expect(s.title).toMatch(/2 students/);
  });
  it("sends a new student to their matches, then keeps the conversation going", () => {
    expect(nextStep(base).href).toBe("/matches");
    expect(nextStep({ ...base, sent: 1 }).href).toBe("/requests");
  });
  it("asks successes to pay it forward", () => {
    expect(nextStep({ ...base, sent: 1, succeeded: true, helpOwed: 3 }).href).toBe("/payitforward");
  });
  it("sends placement accounts to the college dashboard", () => {
    expect(nextStep({ ...base, role: "placement" }).href).toBe("/college");
  });
});

describe("nextStep for other roles and the network", () => {
  const rec: DashboardState = { ...base, role: "recruiter", semesters: 0 };
  it("does not ask recruiters, founders or faculty for a journey", () => {
    expect(nextStep(rec).href).not.toBe("/onboarding");
  });
  it("sends a poster with no posts to the post form, and points at interest in their posts", () => {
    expect(nextStep({ ...rec, myPosts: 0 }).href).toBe("/opportunities/new");
    expect(nextStep({ ...rec, myPosts: 2, interestsOnMine: 3, profilePercent: 100 }).href).toBe("/opportunities/mine");
  });
  it("puts connection requests ahead of the generic suggestions", () => {
    expect(nextStep({ ...base, sent: 1, climbed: true, incomingConnections: 2 }).href).toBe("/network");
  });
  it("asks for a fuller profile before the generic flow", () => {
    expect(nextStep({ ...base, sent: 1, climbed: true, profilePercent: 20 }).href).toBe("/profile");
  });
  it("suggests growing the network when nothing else is pending", () => {
    expect(nextStep({ ...rec, myPosts: 1, profilePercent: 100, connections: 1 }).href).toBe("/people");
  });
  it("gives non-students their own checklist", () => {
    const items = checklist({ ...rec, myPosts: 1, profilePercent: 90, connections: 4 });
    expect(items.map((i) => i.label)).toEqual(["Complete your profile", "Connect with three people", "Post an opportunity"]);
    expect(items.every((i) => i.done)).toBe(true);
  });
});

describe("checklist", () => {
  it("ticks off steps as they happen", () => {
    const items = checklist({ ...base, sent: 1, climbed: true });
    expect(items.map((i) => i.done)).toEqual([true, true, true, true, false]);
  });
});

describe("formatting", () => {
  it("capitalises short branch codes and keeps long names", () => {
    expect(formatBranch("cs")).toBe("CS");
    expect(formatBranch("Mechanical")).toBe("Mechanical");
  });
  it("takes the first name", () => {
    expect(firstName("Naman Verma")).toBe("Naman");
    expect(firstName("nmn")).toBe("nmn");
  });
});
