import { describe, expect, it } from "vitest";
import { safeLink } from "./types";

describe("safeLink", () => {
  it("keeps paths on this site", () => {
    expect(safeLink("/network")).toBe("/network");
    expect(safeLink("/people/11111111-1111-4111-8111-111111111111")).toBe("/people/11111111-1111-4111-8111-111111111111");
  });
  it("drops anything that could leave the site", () => {
    expect(safeLink("https://evil.example")).toBeNull();
    expect(safeLink("//evil.example")).toBeNull();
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink(null)).toBeNull();
  });
});
