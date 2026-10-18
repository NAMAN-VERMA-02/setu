import { describe, expect, it } from "vitest";
import { createAskSchema, patchAskSchema } from "@/lib/validation/asks";
import { mapDbError } from "./errors";
import { forwardUrl, generateToken, hashToken, isWellFormedToken } from "./token";
import { canAdvance, daysLeft, isExpired, nextStep } from "./trust";

describe("forward tokens", () => {
  it("are long, unique, URL-safe and hash deterministically", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toBe(a);
  });
  it("rejects malformed tokens before any lookup", () => {
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("a".repeat(43) + "!")).toBe(false);
    expect(isWellFormedToken("../".repeat(20))).toBe(false);
  });
  it("builds the public link", () => {
    expect(forwardUrl("https://setu.example/", "tok")).toBe("https://setu.example/f/tok");
  });
});

describe("trust ladder", () => {
  it("moves one step at a time and ends at referral", () => {
    expect(nextStep("question")).toBe("call");
    expect(nextStep("task")).toBe("referral");
    expect(nextStep("referral")).toBeNull();
  });
  it("unlocks a referral only after work has been seen", () => {
    expect(canAdvance("task", false)).toBe(false);
    expect(canAdvance("task", true)).toBe(true);
    expect(canAdvance("question", false)).toBe(true);
    expect(canAdvance("referral", true)).toBe(false);
  });
  it("expires exactly at the deadline", () => {
    const now = new Date("2026-10-17T00:00:00Z");
    expect(isExpired("2026-10-17T00:00:00Z", now)).toBe(true);
    expect(isExpired("2026-10-17T00:00:01Z", now)).toBe(false);
  });
});

describe("daysLeft", () => {
  const now = new Date("2026-10-17T00:00:00Z");
  it("rounds up to whole days and floors at zero", () => {
    expect(daysLeft("2026-10-24T00:00:00Z", now)).toBe(7);
    expect(daysLeft("2026-10-17T01:00:00Z", now)).toBe(1);
    expect(daysLeft("2026-10-16T00:00:00Z", now)).toBe(0);
  });
});

describe("validation", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("accepts direct and bridge asks", () => {
    expect(createAskSchema.safeParse({ kind: "direct", targetId: id, message: "Hi" }).success).toBe(true);
    expect(createAskSchema.safeParse({ kind: "bridge", viaId: id, targetCompany: "Cognizant", message: "Hi" }).success).toBe(true);
  });
  it("rejects a bridge without a company and a direct ask without a target", () => {
    expect(createAskSchema.safeParse({ kind: "bridge", viaId: id, message: "Hi" }).success).toBe(false);
    expect(createAskSchema.safeParse({ kind: "direct", message: "Hi" }).success).toBe(false);
  });
  it("only accepts https work links and known actions", () => {
    expect(patchAskSchema.safeParse({ action: "submit_work", workUrl: "https://github.com/x/y" }).success).toBe(true);
    expect(patchAskSchema.safeParse({ action: "submit_work", workUrl: "http://x.com" }).success).toBe(false);
    expect(patchAskSchema.safeParse({ action: "submit_work", workUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(patchAskSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});

describe("mapDbError", () => {
  it("maps known rules and hides everything else", () => {
    expect(mapDbError("this senior already has 3 waiting requests").status).toBe(409);
    expect(mapDbError("some internal pg detail: secret").error).toBe("We could not do that. Please try again.");
  });
});
