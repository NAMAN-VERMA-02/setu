import { tokens } from "@/lib/opportunities/rank";

export type PersonRow = {
  id: string;
  fullName: string;
  role: string;
  batch: number;
  branch: string;
  headline: string | null;
  bio: string | null;
  company: string | null;
  title: string | null;
  location: string | null;
  expertise: string[];
  openTo: string[];
  intents: { kind: string; category: string; statement: string }[];
  lastActiveAt: string;
  helpOwed: number;
  /** How many seniors or faculty have vouched for this person's skills. */
  vouches?: number;
};

export type PeopleQuery = {
  /** Free text, such as "who can help me with GATE and a backlog". */
  text: string;
  role?: string;
  openTo?: string;
  company?: string;
};

export type PeopleSeeker = {
  skills: string[];
  seekIntents: string[];
  goalCompany: string;
};

export type RankedPerson = PersonRow & { score: number; reasons: string[] };

// Words that appear in natural-language questions but say nothing about expertise.
const FILLER = new Set(["help", "who", "can", "someone", "anyone", "find", "how", "what", "have", "has", "does", "know", "knows", "good", "best", "need", "want", "like", "also", "some", "people", "person", "talk", "advice", "about", "that", "there", "their", "them", "than", "then", "when", "where", "which", "while", "would", "could", "should", "please"]);

export function queryTokens(text: string): string[] {
  return tokens(text).filter((t) => !FILLER.has(t));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const norm = (s: string) => s.trim().toLowerCase();

/** Orders people for one searcher and explains each match. Hard filters come first. */
export function rankPeople(query: PeopleQuery, seeker: PeopleSeeker, people: PersonRow[], now: Date = new Date()): RankedPerson[] {
  const want = queryTokens(query.text);
  const mySkills = new Set(seeker.skills.map(norm));
  const seekTokens = queryTokens(seeker.seekIntents.join(" "));
  const company = norm(seeker.goalCompany);
  const companyFilter = query.company ? norm(query.company) : "";

  const out: RankedPerson[] = [];
  for (const p of people) {
    if (query.role && p.role !== query.role) continue;
    if (query.openTo && !p.openTo.includes(query.openTo)) continue;
    if (companyFilter && !norm(p.company ?? "").includes(companyFilter)) continue;

    let score = 0;
    const reasons: string[] = [];

    const expertiseTokens = p.expertise.flatMap((e) => queryTokens(e));
    const offers = p.intents.filter((i) => i.kind === "offer");
    const seeks = p.intents.filter((i) => i.kind === "seek");
    const head = queryTokens(`${p.headline ?? ""} ${p.title ?? ""} ${p.company ?? ""}`);
    const bio = queryTokens(p.bio ?? "");

    if (want.length > 0) {
      let hits = 0;
      const knows = new Set<string>();
      let offerHit: string | null = null;
      for (const t of want) {
        let hit = false;
        if (expertiseTokens.includes(t)) {
          score += 18;
          hit = true;
          knows.add(t);
        }
        const o = offers.find((i) => queryTokens(i.statement).includes(t));
        if (o) {
          score += 16;
          hit = true;
          offerHit ??= o.statement;
        }
        if (head.includes(t)) {
          score += 10;
          hit = true;
        }
        if (bio.includes(t)) {
          score += 4;
          hit = true;
        }
        if (seeks.some((i) => queryTokens(i.statement).includes(t))) {
          score += 3;
          hit = true;
        }
        if (hit) hits += 1;
      }
      if (hits === 0) continue;
      score += hits * 6;
      if (knows.size > 0) reasons.push(`Knows ${[...knows].slice(0, 3).join(", ")}`);
      if (offerHit) reasons.push(`Offers: ${offerHit}`);
    } else {
      // No question asked: suggest people who fit the searcher.
      const shared = p.expertise.filter((e) => mySkills.has(norm(e)));
      if (shared.length > 0) {
        score += Math.min(24, shared.length * 8);
        reasons.push(`Shares your skills: ${shared.slice(0, 3).join(", ")}`);
      }
      const helpful = offers.find((i) => seekTokens.some((t) => queryTokens(i.statement).includes(t)));
      if (helpful) {
        score += 20;
        reasons.push(`Offers: ${helpful.statement}`);
      }
      if (company && norm(p.company ?? "") === company) {
        score += 15;
        reasons.push(`Works at ${p.company}`);
      }
    }

    if (p.openTo.length > 0) {
      score += 3;
      reasons.push(`Open to ${p.openTo.slice(0, 2).join(" and ")}`);
    }
    const idleDays = (now.getTime() - new Date(p.lastActiveAt).getTime()) / DAY_MS;
    if (idleDays <= 30) score += 6;
    else if (idleDays <= 90) score += 3;
    if (p.helpOwed > 0) score += 3;
    const vouched = p.vouches ?? 0;
    if (vouched > 0) {
      score += Math.min(12, vouched * 4);
      reasons.push(`Vouched for by ${vouched} ${vouched === 1 ? "senior" : "seniors"}`);
    }

    out.push({ ...p, score: Math.round(score * 10) / 10, reasons });
  }

  return out.sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id));
}
