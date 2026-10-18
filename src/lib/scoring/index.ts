import { firstLine } from "./message";
import {
  MAX_HOPS,
  MAX_WAITING_PER_SENIOR,
  MIN_COMPANY_COUNT,
  REACH,
  rank,
  responsiveness,
} from "./rank";
import { computeRarity, rarestTrait, rarityBonus } from "./rarity";
import { isVisible, scoreTraits, type TraitKey, type Traits, type Visibility } from "./traits";

export * from "./message";
export * from "./payforward";
export * from "./rank";
export * from "./rarity";
export * from "./routes";
export * from "./rows";
export * from "./traits";

export type Candidate = {
  id: string;
  displayName: string;
  batch: number;
  branch: string;
  /** Their snapshot for the semester being matched. */
  traits: Traits;
  visibility: Visibility;
  lastActiveAt: Date | string;
  helpOwed: number;
  /** Their contacts at the student's target company, as a count only. */
  contacts: { company: string; count: number } | null;
  /** Requests currently waiting on this senior. */
  pendingAsks: number;
};

export type Route =
  | { type: "direct"; hops: 1; rank: number }
  | { type: "via_senior"; hops: 2; rank: number; company: string; contactCount: number };

export type Match = {
  id: string;
  displayName: string;
  batch: number;
  branch: string;
  semester: number;
  /** Base score out of 100. */
  score: number;
  rarityBonus: number;
  /** Traits the senior allows to be shown; hidden marks still count towards the score. */
  sharedTraits: TraitKey[];
  firstLine: string;
  routes: Route[];
  /** Best route's rank. */
  rank: number;
};

export type MatchOptions = { semester: number; now?: Date; limit?: number };

/**
 * Matches one student against seniors' snapshots from the same semester.
 * Rank = (score + rarity bonus) x reach x responsiveness, over at most MAX_HOPS hops.
 */
export function matchSeniors(me: Traits, candidates: Candidate[], options: MatchOptions): Match[] {
  const now = options.now ?? new Date();
  const available = candidates.filter((c) => c.pendingAsks < MAX_WAITING_PER_SENIOR);
  const rarity = computeRarity(me, available.map((c) => c.traits));

  const matches: Match[] = [];
  for (const c of available) {
    const { score, matched } = scoreTraits(me, c.traits);
    // Sharing only the college tier is not a past-self match.
    if (!matched.some((k) => k !== "tier")) continue;

    const bonus = rarityBonus(matched, rarity);
    const adjusted = score + bonus;
    const responsive = responsiveness(c.lastActiveAt, c.helpOwed, now);

    const routes: Route[] = [{ type: "direct", hops: 1, rank: rank(adjusted, REACH.direct, responsive) }];
    if (MAX_HOPS >= 2 && c.contacts && c.contacts.count >= MIN_COMPANY_COUNT) {
      routes.push({
        type: "via_senior",
        hops: 2,
        rank: rank(adjusted, REACH.viaOneSenior, responsive),
        company: c.contacts.company,
        contactCount: c.contacts.count,
      });
    }

    const visibleTraits = matched.filter((k) => isVisible(k, c.visibility));
    const lead = rarestTrait(matched, rarity, (k) => isVisible(k, c.visibility));

    matches.push({
      id: c.id,
      displayName: c.displayName,
      batch: c.batch,
      branch: c.branch,
      semester: options.semester,
      score,
      rarityBonus: bonus,
      sharedTraits: visibleTraits,
      firstLine: firstLine(lead, options.semester, c.traits),
      routes,
      rank: Math.max(...routes.map((r) => r.rank)),
    });
  }

  matches.sort((a, b) => b.rank - a.rank || b.score - a.score || a.id.localeCompare(b.id));
  return matches.slice(0, options.limit ?? matches.length);
}
