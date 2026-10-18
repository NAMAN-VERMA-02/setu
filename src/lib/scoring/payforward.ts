import { firstLine } from "./message";
import { TRAIT_POINTS, isVisible, scoreTraits, type TraitKey, type Traits, type Visibility } from "./traits";

/** How many juniors a success is asked to help. */
export const PAY_IT_FORWARD_COUNT = 3;

export type JuniorInput = {
  id: string;
  displayName: string;
  batch: number;
  branch: string;
  goalTarget: string | null;
  /** The one question this junior would like a senior to answer. */
  question: string;
  /** Their current semester, and their state in it. */
  semester: number;
  traits: Traits;
  visibility: Visibility;
};

export type JuniorPick = {
  id: string;
  displayName: string;
  batch: number;
  branch: string;
  goalTarget: string | null;
  question: string;
  semester: number;
  score: number;
  sharedTraits: TraitKey[];
  firstLine: string;
};

/**
 * Juniors whose today matches the helper's yesterday: for each junior, compare their
 * current semester with the helper's own snapshot from that same semester.
 */
export function pickJuniors(
  helperBySemester: Record<number, Traits>,
  juniors: JuniorInput[],
  limit: number = PAY_IT_FORWARD_COUNT,
): JuniorPick[] {
  const picks: JuniorPick[] = [];

  for (const j of juniors) {
    const then = helperBySemester[j.semester];
    if (!then) continue;

    const { score, matched } = scoreTraits(j.traits, then);
    // Sharing only the college tier is not a past-self match.
    if (!matched.some((k) => k !== "tier")) continue;

    const mentionable = matched.filter((k) => k !== "tier" && isVisible(k, j.visibility));
    const lead = mentionable.reduce<TraitKey | null>(
      (best, k) => (best === null || TRAIT_POINTS[k] > TRAIT_POINTS[best] ? k : best),
      null,
    );

    picks.push({
      id: j.id,
      displayName: j.displayName,
      batch: j.batch,
      branch: j.branch,
      goalTarget: j.goalTarget,
      question: j.question,
      semester: j.semester,
      score,
      sharedTraits: matched.filter((k) => isVisible(k, j.visibility)),
      firstLine: firstLine(lead, j.semester, j.traits),
    });
  }

  picks.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return picks.slice(0, limit);
}
