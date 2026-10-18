import { z } from "zod";
import { parseSkills } from "./journey";

export const OPEN_TO = ["mentoring", "advice", "referrals", "hiring", "projects", "collaborating", "speaking"] as const;
export type OpenTo = (typeof OPEN_TO)[number];

export const OPEN_TO_LABELS: Record<OpenTo, string> = {
  mentoring: "Mentoring",
  advice: "Quick advice",
  referrals: "Referrals",
  hiring: "Hiring",
  projects: "Projects",
  collaborating: "Collaborating",
  speaking: "Speaking",
};

export const INTENT_KINDS = ["seek", "offer"] as const;
export const INTENT_CATEGORIES = ["career", "mentoring", "referral", "project", "research", "hiring", "learning", "other"] as const;
export const INTENT_LABELS: Record<(typeof INTENT_CATEGORIES)[number], string> = {
  career: "Career",
  mentoring: "Mentoring",
  referral: "Referral",
  project: "Project",
  research: "Research",
  hiring: "Hiring",
  learning: "Learning",
  other: "Other",
};

export const FOUNDER_STAGES = ["idea", "pre-seed", "seed", "series A+", "bootstrapped"] as const;

export const MAX_INTENTS = 5;

const text = (max: number) => z.string().trim().max(max);

export const intentSchema = z.object({
  kind: z.enum(INTENT_KINDS),
  category: z.enum(INTENT_CATEGORIES),
  statement: z.string().trim().min(3, "Say a little more").max(200),
});

export const profileSchema = z.object({
  headline: text(140),
  bio: text(800),
  location: text(120),
  currentCompany: text(120),
  currentTitle: text(120),
  expertise: z.array(z.string().trim().min(1).max(40)).max(20),
  openTo: z.array(z.enum(OPEN_TO)).max(OPEN_TO.length),
  intents: z.array(intentSchema).max(MAX_INTENTS),
  // role specific extras
  stage: z.enum(FOUNDER_STAGES).optional(),
  problems: text(400).optional(),
  lab: text(200).optional(),
  hiringFocus: text(300).optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export type ProfileActionState = { ok?: boolean; message?: string; errors?: string[] };

/** Which extra fields each role sees on the profile form. */
export function roleExtras(role: string): ("company" | "stage" | "problems" | "lab" | "hiringFocus")[] {
  switch (role) {
    case "alumni":
      return ["company"];
    case "founder":
      return ["company", "stage", "problems"];
    case "recruiter":
      return ["company", "hiringFocus"];
    case "faculty":
      return ["lab"];
    default:
      return [];
  }
}

/** Splits a comma separated expertise field into at most 20 clean tags. */
export function parseExpertise(textValue: string): string[] {
  return parseSkills(textValue).slice(0, 20);
}
