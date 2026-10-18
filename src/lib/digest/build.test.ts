import { describe, expect, it } from "vitest";
import { buildDigest } from "./build";

const base = { name: "Asha Rao (sample)", siteUrl: "https://setu.example/", unread: [], opportunities: [] };

describe("buildDigest", () => {
  it("sends nothing in a quiet week", () => {
    expect(buildDigest(base)).toBeNull();
  });
  it("lists unread updates and counts the overflow", () => {
    const d = buildDigest({ ...base, unread: Array.from({ length: 9 }, (_, i) => `Update ${i + 1}`) })!;
    expect(d.subject).toBe("9 updates waiting on SETU");
    expect(d.text).toContain("Hi Asha,");
    expect(d.text).toContain("- Update 6");
    expect(d.text).not.toContain("- Update 7");
    expect(d.text).toContain("and 3 more");
    expect(d.text).toContain("https://setu.example/notifications");
  });
  it("sends opportunities alone with a matching subject, capped at three", () => {
    const d = buildDigest({ ...base, opportunities: [1, 2, 3, 4].map((n) => ({ title: `Role ${n}`, company: n === 1 ? "Zoho" : null, kind: "job" })) })!;
    expect(d.subject).toMatch(/opportunities/);
    expect(d.text).toContain("Role 1 at Zoho (job)");
    expect(d.text).not.toContain("Role 4");
  });
  it("always tells people how to stop it", () => {
    expect(buildDigest({ ...base, unread: ["x"] })!.text).toMatch(/Turn it off/);
  });
});
