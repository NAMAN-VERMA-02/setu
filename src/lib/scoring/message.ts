import type { TraitKey, Traits } from "./traits";

const DECISION_WORDS: Record<string, string> = {
  gate: "preparing for GATE",
  job: "aiming for a job",
  startup: "pulled towards startups",
  higher_studies: "planning higher studies",
  other: "weighing other options",
};

/**
 * Opening line of the first message: the rarest thing the two share.
 * Only uses values the senior agreed to show (callers pass a mentionable trait).
 */
export function firstLine(trait: TraitKey | null, semester: number, theirs: Traits): string {
  switch (trait) {
    case "backlogs":
      return theirs.backlogCount === 0
        ? `You both finished semester ${semester} with no backlogs.`
        : `You also had ${theirs.backlogCount} ${theirs.backlogCount === 1 ? "backlog" : "backlogs"} in semester ${semester}.`;
    case "decision":
      return `In semester ${semester} you were both ${DECISION_WORDS[theirs.decision ?? "other"] ?? "weighing options"}.`;
    case "branch":
      return `You are both from ${theirs.branch}.`;
    case "cgpa":
      return `You both had a CGPA around ${theirs.cgpaRange} in semester ${semester}.`;
    case "tenth":
      return `You both scored around ${theirs.tenthRange}% in 10th.`;
    case "twelfth":
      return `You both scored around ${theirs.twelfthRange}% in 12th.`;
    default:
      return `You were in the same semester, ${semester}, at the same college.`;
  }
}
