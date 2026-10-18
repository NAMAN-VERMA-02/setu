/** What we know about the person looking at the board. */
export type Seeker = {
  /** Expertise and journey skills. */
  skills: string[];
  /** Their goal, e.g. "SDE at Cognizant", and its company. */
  goalText: string;
  goalCompany: string;
  /** Statements from their "looking for" intents. */
  seekIntents: string[];
};

export type OppRow = {
  id: string;
  kind: string;
  title: string;
  description: string;
  company: string | null;
  skills: string[];
  createdAt: string;
  deadline: string | null;
};

export type RankedOpp<T extends OppRow = OppRow> = T & { score: number; reasons: string[] };

const STOP = new Set(["the", "and", "for", "with", "you", "are", "our", "who", "can", "get", "any", "from", "that", "this", "your", "into", "about", "need", "looking", "want"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export function tokens(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9+#.]+/).filter((t) => t.length >= 3 && !STOP.has(t)))];
}

const norm = (s: string) => s.trim().toLowerCase();

function ago(days: number): string {
  if (days < 1) return "today";
  const d = Math.floor(days);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/**
 * Orders opportunities for one person and says why each one fits.
 * Expired ones are dropped. Ties go to the newer post.
 */
export function rankOpportunities<T extends OppRow>(seeker: Seeker, opps: T[], now: Date = new Date()): RankedOpp<T>[] {
  const mySkills = new Set(seeker.skills.map(norm));
  const goalTokens = tokens(seeker.goalText);
  const intentTokens = tokens(seeker.seekIntents.join(" "));
  const company = norm(seeker.goalCompany);

  const out: RankedOpp<T>[] = [];
  for (const o of opps) {
    if (o.deadline && new Date(`${o.deadline}T23:59:59Z`).getTime() < now.getTime()) continue;

    let score = 0;
    const reasons: string[] = [];

    const sharedSkills = o.skills.filter((s) => mySkills.has(norm(s)));
    if (sharedSkills.length > 0) {
      score += Math.min(48, sharedSkills.length * 16);
      reasons.push(`Uses your skills: ${sharedSkills.slice(0, 3).join(", ")}`);
    }

    const haystack = tokens(`${o.title} ${o.company ?? ""} ${o.description}`);
    if (company && o.company && norm(o.company) === company) {
      score += 24;
      reasons.push(`At your target company, ${o.company}`);
    } else {
      const goalHits = goalTokens.filter((t) => haystack.includes(t));
      if (goalHits.length > 0) {
        score += Math.min(14, goalHits.length * 7);
        reasons.push("Matches your goal");
      }
    }

    const intentHits = intentTokens.filter((t) => haystack.includes(t));
    if (intentHits.length > 0) {
      score += Math.min(12, intentHits.length * 6);
      reasons.push("Fits what you are looking for");
    }

    const age = Math.max(0, (now.getTime() - new Date(o.createdAt).getTime()) / DAY_MS);
    const fresh = Math.max(0, 10 - age / 3);
    score += fresh;
    if (age < 7) reasons.push(`Posted ${ago(age)}`);

    out.push({ ...o, score: Math.round(score * 10) / 10, reasons });
  }

  return out.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}
