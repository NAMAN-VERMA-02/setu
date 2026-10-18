export type ImportRow = { fullName: string; batch: number; branch: string; email: string | null };
export type ParseResult = { rows: ImportRow[]; problems: string[] };

export const MAX_IMPORT_ROWS = 500;

const HEADERS: Record<string, "name" | "batch" | "branch" | "email"> = {
  name: "name",
  "full name": "name",
  fullname: "name",
  batch: "batch",
  "passing year": "batch",
  year: "batch",
  "graduation year": "batch",
  branch: "branch",
  department: "branch",
  course: "branch",
  email: "email",
  "e-mail": "email",
  "email id": "email",
};

/** Splits one CSV line, honouring double quotes and doubled quotes inside them. */
function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reads an alumni list pasted or uploaded as CSV. A header row naming name, batch and branch is
 * required (email is optional); commas, semicolons and tabs all work. Bad lines are reported, not
 * guessed at, so the placement cell can fix the file.
 */
export function parseAlumniCsv(text: string, now: Date = new Date()): ParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], problems: ["The file is empty."] };

  const sep = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const header = splitLine(lines[0], sep).map((h) => HEADERS[h.toLowerCase()]);
  for (const need of ["name", "batch", "branch"] as const) {
    if (!header.includes(need)) return { rows: [], problems: [`The first line must name the columns, including "${need}".`] };
  }

  const rows: ImportRow[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();
  const maxYear = now.getFullYear();

  for (let i = 1; i < lines.length; i++) {
    if (rows.length >= MAX_IMPORT_ROWS) {
      problems.push(`Only the first ${MAX_IMPORT_ROWS} people are imported at a time.`);
      break;
    }
    const cells = splitLine(lines[i], sep);
    const get = (k: "name" | "batch" | "branch" | "email") => cells[header.indexOf(k)]?.trim() ?? "";
    const fullName = get("name");
    const batch = Number(get("batch"));
    const branch = get("branch");
    const email = get("email").toLowerCase();

    if (fullName.length < 2 || fullName.length > 120) problems.push(`Line ${i + 1}: the name is missing or too long.`);
    else if (!Number.isInteger(batch) || batch < 1980 || batch > maxYear) problems.push(`Line ${i + 1}: batch "${get("batch")}" is not a year between 1980 and ${maxYear}.`);
    else if (branch.length < 1 || branch.length > 60) problems.push(`Line ${i + 1}: the branch is missing.`);
    else if (email && !EMAIL.test(email)) problems.push(`Line ${i + 1}: "${email}" is not an email address.`);
    else if (email && seen.has(email)) problems.push(`Line ${i + 1}: ${email} appears twice.`);
    else {
      if (email) seen.add(email);
      rows.push({ fullName, batch, branch, email: email || null });
    }
  }
  return { rows, problems };
}

/** A short invitation the placement cell can send from its own mail client. */
export function inviteMessage(name: string, siteUrl: string): { subject: string; body: string } {
  const first = name.trim().split(/\s+/)[0] || "there";
  return {
    subject: "Join our alumni network on SETU",
    body: `Hi ${first},\n\nOur college now has SETU, a network where students find seniors from the same semester and ask for one real piece of advice. Your journey could shorten someone's path.\n\nJoin here with your college email: ${siteUrl}/signup\n\nThank you!`,
  };
}
