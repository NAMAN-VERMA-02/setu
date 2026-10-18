/** Points and Karz. Rank = Points - Karz. Points are only earned by helping; they cannot be bought. */
export const POINTS = {
  hopYes: 10,
  targetQuestion: 10,
  targetCall: 25,
  targetReferral: 50,
  hired: 100,
  payForwardAnswer: 25,
} as const;

/** Karz (debt) added to the person who asks for an intro. */
export const KARZ_PER_ASK = 10;

export type TargetResponse = "question" | "call" | "referral";

export function pointsForTarget(response: TargetResponse): number {
  return response === "referral" ? POINTS.targetReferral : response === "call" ? POINTS.targetCall : POINTS.targetQuestion;
}

export function rank(points: number, karz: number): number {
  return points - karz;
}
