type Person = { pid: string; story_key: string | null; role: string; public_title: string | null; public_company: string | null };

const KINDS = ["job", "internship", "project", "referral"] as const;
const SKILL_SETS = [["python", "ml"], ["web", "dsa"], ["cloud", "python"], ["design", "web"], ["ml", "dsa"]];

/** Opportunities posted by alumni, from their public cards. Deterministic (first 12 alumni with a company). */
export function buildOpportunities(people: Person[]) {
  return people
    .filter((p) => p.role === "alum" && p.public_company && p.public_title && !p.story_key)
    .sort((a, b) => a.pid.localeCompare(b.pid))
    .slice(0, 12)
    .map((p, i) => ({
      poster_pid: p.pid,
      title: i % 3 === 0 ? `${p.public_title} (referral open)` : `${KINDS[i % KINDS.length] === "internship" ? "Intern" : "Engineer"} — ${p.public_company}`,
      company: p.public_company,
      kind: KINDS[i % KINDS.length],
      skills: SKILL_SETS[i % SKILL_SETS.length],
      blurb: `Open from a ${p.public_company} alum. Ask for an intro and Setu will find the warmest route.`,
    }));
}
