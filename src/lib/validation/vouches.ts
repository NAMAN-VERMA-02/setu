import { z } from "zod";

export const vouchSchema = z.object({
  studentId: z.uuid(),
  skill: z.string().trim().min(2, "Name the skill.").max(40),
  note: z.string().trim().max(300).optional(),
});

/** Turns a database error from the vouch guard into something a person can act on. */
export function vouchError(message: string): { error: string; status: number } {
  if (/seen their work/.test(message)) return { error: "You can vouch once you have seen their work.", status: 403 };
  if (/too many vouches/.test(message)) return { error: "That is plenty for today. Come back tomorrow.", status: 429 };
  if (/college/.test(message)) return { error: "You can only vouch for people from your college.", status: 422 };
  if (/students/.test(message)) return { error: "Vouches are for students.", status: 422 };
  if (/role cannot/.test(message)) return { error: "Your role cannot vouch.", status: 403 };
  if (/duplicate key|vouches_unique/.test(message)) return { error: "You already vouched for that skill.", status: 409 };
  return { error: "We could not save that. Please try again.", status: 400 };
}
