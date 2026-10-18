import { describe, expect, it } from "vitest";
import { journeySchema, parseSkills } from "./journey";

const snap = { semester: 3, cgpaRange: "6.5-7", backlogCount: 1, skills: ["SQL"], status: "", decision: "job", showCgpa: false };
const base = { goalTarget: "SDE at Cognizant", goalCompany: "", tenthRange: "65-70", twelfthRange: null, showTenth: false, showTwelfth: false, snapshots: [snap] };

describe("journeySchema", () => {
  it("accepts a valid journey", () => {
    expect(journeySchema.safeParse(base).success).toBe(true);
  });
  it("rejects exact marks and unknown ranges", () => {
    expect(journeySchema.safeParse({ ...base, tenthRange: "69" }).success).toBe(false);
    expect(journeySchema.safeParse({ ...base, snapshots: [{ ...snap, cgpaRange: "6.83" }] }).success).toBe(false);
  });
  it("rejects duplicate semesters and an empty list", () => {
    expect(journeySchema.safeParse({ ...base, snapshots: [snap, snap] }).success).toBe(false);
    expect(journeySchema.safeParse({ ...base, snapshots: [] }).success).toBe(false);
  });
});

describe("parseSkills", () => {
  it("trims, de-duplicates case-insensitively and drops blanks", () => {
    expect(parseSkills(" React, sql,SQL, ,react ")).toEqual(["React", "sql"]);
  });
});
