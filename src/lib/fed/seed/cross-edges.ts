/**
 * Edges that cross colleges, by story key. The hub resolves the keys to pseudonymous ids on reset.
 * (Edges inside a college come from that college's own node.)
 */
export const STORY_CROSS_EDGES: { a: string; b: string; prior: number }[] = [
  { a: "aman", b: "karan", prior: 0.3 },
  { a: "rohan", b: "vikram", prior: 0.8 },
  { a: "priya", b: "meera", prior: 0.6 },
  // professionals and alumni live in one network: a college alum who knows the doctor and the developer
  { a: "ananya", b: "kavya", prior: 0.5 },
  { a: "kavya", b: "ishaan", prior: 0.6 },
  { a: "rahul", b: "arjun", prior: 0.55 },
];

/** Public-company colleagues across colleges get a modest edge; story people are never touched. */
export const COLLEAGUE_PRIOR_RANGE = { min: 0.45, max: 0.65 } as const;
