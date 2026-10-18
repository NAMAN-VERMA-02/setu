import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The hub must never be able to hold identifying data. This reads the migration and fails if any
// fed_ column is named like something identifying.
const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261021000021_fed_hub.sql"), "utf8");
const FORBIDDEN = /^(name|full_name|email|phone|cgpa|dob|note|notes|text_body|body|message)$/;

function columnsOfFedTables(): { table: string; column: string }[] {
  const out: { table: string; column: string }[] = [];
  const re = /create table public\.(fed_\w+) \(([\s\S]*?)\n\);/g;
  for (const m of sql.matchAll(re)) {
    for (const line of m[2].split("\n")) {
      const col = line.trim().match(/^([a-z_]+)\s+(text|int|smallint|real|boolean|uuid|bigserial|timestamptz|text\[\])/);
      if (col) out.push({ table: m[1], column: col[1] });
    }
  }
  return out;
}

describe("hub schema stays non-identifying", () => {
  const cols = columnsOfFedTables();

  it("finds the fed tables", () => {
    expect(new Set(cols.map((c) => c.table)).size).toBeGreaterThanOrEqual(10);
  });

  it("has no identifying column names", () => {
    // fed_nodes.name is the college's name; fed_audit.note is written by the hub itself (never user text).
    const allowed = new Set(["fed_nodes.name", "fed_audit.note"]);
    const bad = cols.filter((c) => FORBIDDEN.test(c.column) && !allowed.has(`${c.table}.${c.column}`));
    expect(bad).toEqual([]);
  });

  it("allows free text only in fed_events.text, fed_opportunities.blurb and audit notes", () => {
    const texty = cols.filter((c) => c.column === "text" || c.column === "blurb" || c.column === "note");
    expect(texty.map((c) => `${c.table}.${c.column}`).sort()).toEqual(["fed_audit.note", "fed_events.text", "fed_opportunities.blurb"]);
  });
});
