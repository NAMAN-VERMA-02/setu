import { z } from "zod";

export const OPP_KINDS = ["job", "internship", "project", "research", "referral", "mentorship", "event"] as const;
export type OppKind = (typeof OPP_KINDS)[number];

export const OPP_LABELS: Record<OppKind, string> = {
  job: "Job",
  internship: "Internship",
  project: "Project",
  research: "Research",
  referral: "Referral",
  mentorship: "Mentorship",
  event: "Event",
};

/** Roles that may post. The database enforces the same list. */
export const POSTER_ROLES = ["alumni", "faculty", "founder", "recruiter", "placement"] as const;
export const canPost = (role: string) => (POSTER_ROLES as readonly string[]).includes(role);

export const createOpportunitySchema = z.object({
  kind: z.enum(OPP_KINDS),
  title: z.string().trim().min(3, "Give it a clear title").max(120),
  description: z.string().trim().min(1, "Describe it in a few lines").max(2000),
  company: z.string().trim().max(120).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(15),
  mode: z.enum(["onsite", "remote", "hybrid"]).optional(),
  location: z.string().trim().max(120).optional(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional(),
});

export const interestSchema = z.object({ note: z.string().trim().max(500).optional() });
export const interestStatusSchema = z.object({ status: z.enum(["seen", "shortlisted"]) });
export const closeSchema = z.object({ status: z.literal("closed") });

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
