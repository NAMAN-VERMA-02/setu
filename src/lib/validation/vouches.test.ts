import { describe, expect, it } from "vitest";
import { vouchError, vouchSchema } from "./vouches";

const id = "11111111-1111-4111-8111-111111111111";

describe("vouchSchema", () => {
  it("accepts a skill with an optional note", () => {
    expect(vouchSchema.safeParse({ studentId: id, skill: " React ", note: "Built the college fest site" }).data?.skill).toBe("React");
  });
  it("rejects a bad id, a one-letter skill and a long note", () => {
    expect(vouchSchema.safeParse({ studentId: "x", skill: "React" }).success).toBe(false);
    expect(vouchSchema.safeParse({ studentId: id, skill: "R" }).success).toBe(false);
    expect(vouchSchema.safeParse({ studentId: id, skill: "React", note: "x".repeat(301) }).success).toBe(false);
  });
});

describe("vouchError", () => {
  it("maps guard messages to plain language and the right status", () => {
    expect(vouchError("you can vouch once you have seen their work").status).toBe(403);
    expect(vouchError("too many vouches today").status).toBe(429);
    expect(vouchError("not from your college").status).toBe(422);
    expect(vouchError('duplicate key value violates unique constraint "vouches_unique_idx"').status).toBe(409);
    expect(vouchError("boom").status).toBe(400);
  });
});
