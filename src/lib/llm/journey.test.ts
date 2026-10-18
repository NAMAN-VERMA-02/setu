import { describe, expect, it } from "vitest";
import { calendarNote, normalizeDraft, type ModelOutput } from "./journey";

describe("normalizeDraft", () => {
  it("drops out-of-range semesters and duplicates, clamps text", () => {
    const out: ModelOutput = {
      timeline: [
        { semester: 99, kind: "project", title: "Chat app", organization: null, summary: "x".repeat(500) },
        { semester: 3, kind: "internship", title: "  ", organization: "Acme", summary: "" },
      ],
      semesters: [
        { semester: 3, skills: ["React", "react", "SQL"], status: "Internship", decision: "job" },
        { semester: 3, skills: ["Dup"], status: "dup", decision: null },
        { semester: 0, skills: [], status: "", decision: null },
        { semester: 9, skills: [], status: "", decision: null },
      ],
    };
    const d = normalizeDraft(out);
    expect(d.timeline).toHaveLength(1);
    expect(d.timeline[0].semester).toBeNull();
    expect(d.timeline[0].summary).toHaveLength(240);
    expect(d.semesters).toEqual([{ semester: 3, skills: ["React", "SQL"], status: "Internship", decision: "job" }]);
  });
});

describe("calendarNote", () => {
  it("anchors semester 1 four years before graduation", () => {
    expect(calendarNote(2028)).toContain("August 2024");
  });
});
