import { describe, expect, it } from "vitest";
import { POINTS, pointsForTarget, rank } from "./points";
import { hopToken, hopUrl, mintViewerToken, signSession, verifyHopToken, verifySession, verifyViewerToken } from "./tokens";

describe("session cookie", () => {
  it("round-trips and rejects tampering or a different secret", () => {
    const t = signSession("s1", { pid: "ngit_abc", node: "ngit" });
    expect(verifySession("s1", t)).toEqual({ pid: "ngit_abc", node: "ngit" });
    expect(verifySession("s2", t)).toBeNull();
    expect(verifySession("s1", t.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBeNull();
    expect(verifySession("s1", "garbage")).toBeNull();
    expect(verifySession("s1", undefined)).toBeNull();
  });
});

describe("viewer token", () => {
  it("verifies, expires after 2 hours and rejects other secrets", () => {
    const now = 1_000_000_000_000;
    const t = mintViewerToken("v", "ngit_abc", now);
    expect(verifyViewerToken("v", t, now + 1000)).toEqual({ pid: "ngit_abc" });
    expect(verifyViewerToken("v", t, now + 2 * 3600 * 1000 + 1000)).toBeNull();
    expect(verifyViewerToken("other", t, now)).toBeNull();
  });

  it("matches the format the Python node verifies: base64url(payload).base64url(HMAC(payload))", async () => {
    const { createHmac } = await import("node:crypto");
    const t = mintViewerToken("v", "ngit_abc", 0);
    const [payload, mac] = t.split(".");
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({ pid: "ngit_abc", exp: 7200 });
    expect(mac).toBe(createHmac("sha256", "v").update(payload).digest("base64url"));
  });
});

describe("hop token", () => {
  const id = "3f1c2d4e-0000-4000-8000-000000000001";
  it("verifies for the right secret only, and is 22 chars of mac", () => {
    const t = hopToken("h", id);
    expect(verifyHopToken("h", t)).toBe(id);
    expect(verifyHopToken("x", t)).toBeNull();
    expect(t.split(".")[1]).toHaveLength(22);
  });
  it("rejects a token for a different hop and malformed input", () => {
    const t = hopToken("h", id);
    const other = hopToken("h", "other-hop");
    expect(verifyHopToken("h", `${t.split(".")[0]}.${other.split(".")[1]}`)).toBeNull();
    expect(verifyHopToken("h", "nodot")).toBeNull();
    expect(verifyHopToken("h", "")).toBeNull();
  });
  it("builds a link under /h/", () => {
    expect(hopUrl("https://x.app/", "h", id)).toMatch(/^https:\/\/x\.app\/h\/[\w-]+\.[\w-]{22}$/);
  });
});

describe("points", () => {
  it("uses the published amounts", () => {
    expect(POINTS.hopYes).toBe(10);
    expect(pointsForTarget("question")).toBe(10);
    expect(pointsForTarget("call")).toBe(25);
    expect(pointsForTarget("referral")).toBe(50);
    expect(POINTS.hired).toBe(100);
    expect(rank(1240, 0)).toBe(1240);
    expect(rank(40, 140)).toBe(-100);
  });
});
