import { describe, expect, it } from "vitest";
import { findRoutes, neighbourhood, type BridgeEdge } from "./bridge";

const story: BridgeEdge[] = [
  { a: "aman", b: "rohan", p: 0.9 },
  { a: "rohan", b: "priya", p: 0.7 },
  { a: "aman", b: "karan", p: 0.3 },
  { a: "karan", b: "meera", p: 0.4 },
  { a: "rohan", b: "vikram", p: 0.8 },
  { a: "vikram", b: "meera", p: 0.55 },
  { a: "priya", b: "meera", p: 0.6 },
];

describe("bridge routing", () => {
  it("finds the best chain, not the shortest", () => {
    const { best, shortest } = findRoutes({ source: "aman", target: "meera", edges: story });
    expect(best?.path).toEqual(["aman", "rohan", "vikram", "meera"]);
    expect(best?.prob).toBeCloseTo(0.396, 6);
    expect(shortest?.path).toEqual(["aman", "karan", "meera"]);
    expect(shortest?.prob).toBeCloseTo(0.12, 6);
  });

  it("re-routes through Priya after Vikram declines", () => {
    const { best } = findRoutes({ source: "aman", target: "meera", edges: story, exclude: ["vikram"] });
    expect(best?.path).toEqual(["aman", "rohan", "priya", "meera"]);
    expect(best?.prob).toBeCloseTo(0.378, 6);
  });

  it("re-routes from the last person who said yes", () => {
    const { best } = findRoutes({ source: "rohan", target: "meera", edges: story, exclude: ["vikram", "aman"] });
    expect(best?.path).toEqual(["rohan", "priya", "meera"]);
    expect(best?.prob).toBeCloseTo(0.42, 6);
  });

  it("never needs more than 3 people in between", () => {
    const chain: BridgeEdge[] = ["a", "b", "c", "d", "e", "f"].slice(0, -1).map((x, i) => ({ a: x, b: "bcdef"[i], p: 0.9 }));
    expect(findRoutes({ source: "a", target: "e", edges: chain }).best?.path).toEqual(["a", "b", "c", "d", "e"]); // 3 between
    expect(findRoutes({ source: "a", target: "f", edges: chain }).best).toBeNull(); // 4 between
  });

  it("is unreachable when exclusions cut every path", () => {
    expect(findRoutes({ source: "aman", target: "meera", edges: story, exclude: ["vikram", "priya", "karan"] }).best).toBeNull();
  });

  it("treats an offline college as excluded", () => {
    const offline = ["meera", "vikram"]; // the whole RCE side
    expect(findRoutes({ source: "aman", target: "meera", edges: story, exclude: offline }).best).toBeNull();
    expect(findRoutes({ source: "aman", target: "priya", edges: story, exclude: offline }).best?.path).toEqual(["aman", "rohan", "priya"]);
  });

  it("never excludes the requester and never loops", () => {
    const { best } = findRoutes({ source: "aman", target: "meera", edges: story, exclude: ["aman"] });
    expect(best?.path[0]).toBe("aman");
    expect(new Set(best?.path).size).toBe(best?.path.length);
  });

  it("returns nothing for source = target", () => {
    expect(findRoutes({ source: "aman", target: "aman", edges: story }).best).toBeNull();
  });

  it("breaks length ties by the higher probability", () => {
    const edges: BridgeEdge[] = [
      { a: "s", b: "x", p: 0.5 },
      { a: "x", b: "t", p: 0.5 },
      { a: "s", b: "y", p: 0.9 },
      { a: "y", b: "t", p: 0.9 },
    ];
    expect(findRoutes({ source: "s", target: "t", edges }).shortest?.path).toEqual(["s", "y", "t"]);
  });

  it("draws a small neighbourhood", () => {
    const near = neighbourhood(story, ["meera"], 1);
    expect(near.map((e) => [e.a, e.b].sort().join("-")).sort()).toEqual(["karan-meera", "meera-vikram", "meera-priya"].map((s) => s.split("-").sort().join("-")).sort());
  });
});
