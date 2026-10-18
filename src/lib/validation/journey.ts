import { z } from "zod";

/** Marks are only ever stored and shown as ranges. */
export const CGPA_BUCKETS = ["0-4", "4-4.5", "4.5-5", "5-5.5", "5.5-6", "6-6.5", "6.5-7", "7-7.5", "7.5-8", "8-8.5", "8.5-9", "9-9.5", "9.5-10"] as const;
export const PERCENT_BUCKETS = ["0-40", "40-45", "45-50", "50-55", "55-60", "60-65", "65-70", "70-75", "75-80", "80-85", "85-90", "90-95", "95-100"] as const;
export const DECISIONS = ["gate", "job", "startup", "higher_studies", "other"] as const;
export const DECISION_LABELS: Record<(typeof DECISIONS)[number], string> = {
  gate: "GATE / exams",
  job: "Job",
  startup: "Startup",
  higher_studies: "Higher studies",
  other: "Other",
};
export const MAX_SEMESTERS = 8;

const cgpaRange = z.enum(CGPA_BUCKETS);
const percentRange = z.enum(PERCENT_BUCKETS);

const skill = z.string().trim().min(1).max(40);

export const snapshotSchema = z.object({
  semester: z.number().int().min(1).max(MAX_SEMESTERS),
  cgpaRange: cgpaRange.nullable(),
  backlogCount: z.number().int().min(0).max(50),
  skills: z.array(skill).max(40),
  status: z.string().trim().max(200),
  decision: z.enum(DECISIONS).nullable(),
  showCgpa: z.boolean(),
});

export const journeySchema = z
  .object({
    goalTarget: z.string().trim().min(1, "Tell us your goal").max(200),
    goalCompany: z.string().trim().max(120),
    /** The one question this student would like a senior to answer (shown to seniors giving back). */
    goalQuestion: z.string().trim().max(300).optional(),
    tenthRange: percentRange.nullable(),
    twelfthRange: percentRange.nullable(),
    showTenth: z.boolean(),
    showTwelfth: z.boolean(),
    snapshots: z.array(snapshotSchema).min(1, "Add at least one semester").max(MAX_SEMESTERS),
  })
  .refine((v) => new Set(v.snapshots.map((s) => s.semester)).size === v.snapshots.length, {
    message: "Each semester can appear only once",
    path: ["snapshots"],
  });

export type SnapshotInput = z.infer<typeof snapshotSchema>;
export type JourneyInput = z.infer<typeof journeySchema>;

export type JourneyActionState = {
  ok?: boolean;
  message?: string;
  errors?: string[];
};

/** Splits a comma-separated skills field into a clean, de-duplicated list. */
export function parseSkills(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const s = raw.trim().slice(0, 40);
    const key = s.toLowerCase();
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
    if (out.length === 40) break;
  }
  return out;
}
