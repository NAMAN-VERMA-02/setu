import { z } from "zod";

export const ROLES = ["student", "alumni", "faculty", "founder", "recruiter"] as const;
export type SignupRole = (typeof ROLES)[number];

export const MIN_AGE = 18;

/** True when `dob` (YYYY-MM-DD) is a real date and the person is at least MIN_AGE today. */
export function isAdult(dob: string, now: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real =
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  if (!real || y < 1900) return false;
  const cutoff = Date.UTC(now.getUTCFullYear() - MIN_AGE, now.getUTCMonth(), now.getUTCDate());
  return date.getTime() <= cutoff;
}

/** Accepts the exact college domain or any subdomain of it (e.g. cse.kiet.edu). */
export function emailMatchesCollege(email: string, domains: string[]): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

const email = z.string().trim().toLowerCase().email("Enter a valid email").max(254);

const optionalText = (max: number) => z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(max).optional());

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name").max(120),
    email,
    password: z.string().min(10, "Use at least 10 characters").max(72, "Use at most 72 characters"),
    role: z.enum(ROLES, { error: "Choose a role" }).optional(),
    branch: optionalText(80),
    batch: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(1990, "Enter a valid batch year").max(2100, "Enter a valid batch year").optional()),
    dob: z.string().refine((v) => isAdult(v), `You must be ${MIN_AGE} or older to join SETU`),
    /** A single-use invite for recruiters and founders, who do not have a college email. */
    inviteCode: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().regex(/^[a-f0-9]{12}$/, "That invite code looks wrong").optional()),
  })
  .superRefine((v, ctx) => {
    if (v.inviteCode) return;
    if (!v.role) ctx.addIssue({ code: "custom", path: ["role"], message: "Choose a role" });
    if (!v.branch) ctx.addIssue({ code: "custom", path: ["branch"], message: "Enter your branch" });
    if (v.batch === undefined) ctx.addIssue({ code: "custom", path: ["batch"], message: "Enter a valid batch year" });
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(72),
});

export type AuthFormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
};
