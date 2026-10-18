import { describe, expect, it } from "vitest";
import { inviteMessage, MAX_IMPORT_ROWS, parseAlumniCsv } from "./csv";

const NOW = new Date("2026-10-18T00:00:00Z");

describe("parseAlumniCsv", () => {
  it("reads a normal file, lowercases emails and allows a missing email", () => {
    const r = parseAlumniCsv("Name,Batch,Branch,Email\nAsha Rao,2019,CSE,ASHA@Mail.com\nVikram Das,2021,ECE,\n", NOW);
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([
      { fullName: "Asha Rao", batch: 2019, branch: "CSE", email: "asha@mail.com" },
      { fullName: "Vikram Das", batch: 2021, branch: "ECE", email: null },
    ]);
  });

  it("accepts other separators, header names, quotes and a byte-order mark", () => {
    const r = parseAlumniCsv('﻿Full Name;Passing Year;Department\n"Rao, Asha";2019;CSE', NOW);
    expect(r.rows).toEqual([{ fullName: "Rao, Asha", batch: 2019, branch: "CSE", email: null }]);
  });

  it("reports bad lines instead of guessing", () => {
    const r = parseAlumniCsv("name,batch,branch,email\nA,2019,CSE,\nBina Roy,1950,CSE,\nChet Jha,2020,,\nDev Pal,2020,CSE,not-an-email\nEli Das,2020,CSE,e@x.com\nEli Das,2020,CSE,e@x.com", NOW);
    expect(r.rows.map((x) => x.fullName)).toEqual(["Eli Das"]);
    expect(r.problems).toHaveLength(5);
    expect(r.problems.join(" ")).toMatch(/Line 2.*name/);
    expect(r.problems.join(" ")).toMatch(/Line 3.*batch/);
    expect(r.problems.join(" ")).toMatch(/Line 7.*twice/);
  });

  it("requires the name, batch and branch columns", () => {
    expect(parseAlumniCsv("name,email\nAsha,a@x.com", NOW).problems[0]).toMatch(/batch/);
    expect(parseAlumniCsv("", NOW).problems[0]).toMatch(/empty/);
  });

  it("stops at the row limit", () => {
    const body = Array.from({ length: MAX_IMPORT_ROWS + 5 }, (_, i) => `Person ${i},2020,CSE,p${i}@x.com`).join("\n");
    const r = parseAlumniCsv(`name,batch,branch,email\n${body}`, NOW);
    expect(r.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(r.problems[0]).toMatch(/first 500/);
  });
});

describe("inviteMessage", () => {
  it("greets by first name and links to signup", () => {
    const m = inviteMessage("Asha Rao", "https://setu.example");
    expect(m.body).toContain("Hi Asha,");
    expect(m.body).toContain("https://setu.example/signup");
  });
});
