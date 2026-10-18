import { describe, expect, it } from "vitest";
import { buildRouteMap } from "./routes";

const o = (decision: string | null, company: string | null = null) => ({ decision, company });

describe("buildRouteMap", () => {
  it("counts routes and destinations, biggest first", () => {
    const map = buildRouteMap([
      o("job", "Cognizant"), o("job", "Cognizant"), o("job", "TCS"), o("job", "TCS"), o("job", "Zoho"),
      o("gate"), o("gate"),
      o("startup", "Acme"), o("startup", "Acme"),
    ]);
    expect(map.total).toBe(9);
    expect(map.branches.map((b) => [b.decision, b.count])).toEqual([["job", 5], ["gate", 2], ["startup", 2]]);
    expect(map.branches[0].destinations).toEqual([
      { label: "Cognizant", count: 2 },
      { label: "TCS", count: 2 },
      { label: "Other companies", count: 1 },
    ]);
  });

  it("folds a route taken by one person into 'something else'", () => {
    const map = buildRouteMap([o("job"), o("job"), o("startup", "Solo")]);
    expect(map.branches.map((b) => b.decision)).toEqual(["job", "other"]);
    expect(map.branches[1].count).toBe(1);
    expect(JSON.stringify(map)).not.toContain("Solo");
  });

  it("keeps undecided people under 'something else'", () => {
    const map = buildRouteMap([o(null), o(null), o("job"), o("job")]);
    expect(map.branches.find((b) => b.decision === "other")?.count).toBe(2);
  });

  it("handles no matches", () => {
    expect(buildRouteMap([])).toEqual({ total: 0, branches: [] });
  });
});
