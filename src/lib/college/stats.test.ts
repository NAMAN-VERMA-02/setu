import { describe, expect, it } from "vitest";
import { pct } from "./stats";

describe("pct", () => {
  it("rounds to a whole percentage", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
  });
  it("is 0 when there is nothing to divide by", () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(0, 0)).toBe(0);
  });
  it("never exceeds 100", () => {
    expect(pct(12, 10)).toBe(100);
  });
});
