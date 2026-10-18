import { roleExtras } from "@/lib/validation/profile";

export type ProfileFacts = {
  role: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  current_company: string | null;
  current_title: string | null;
  expertise: string[] | null;
  open_to: string[] | null;
  details: Record<string, unknown> | null;
  intents: number;
};

export type Completeness = { percent: number; missing: string[] };

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

/** How complete a profile is, and the first things worth adding. */
export function profileCompleteness(p: ProfileFacts): Completeness {
  const extras = roleExtras(p.role);
  const checks: [string, boolean][] = [
    ["a headline", filled(p.headline)],
    ["a short bio", filled(p.bio)],
    ["what you are good at", (p.expertise?.length ?? 0) >= 3],
    ["what you are open to", (p.open_to?.length ?? 0) >= 1],
    ["what you are looking for or can offer", p.intents >= 1],
    ["where you are based", filled(p.location)],
  ];
  if (extras.includes("company")) checks.push(["your company", filled(p.current_company)]);
  if (extras.includes("company") && p.role === "alumni") checks.push(["your job title", filled(p.current_title)]);
  const d = p.details ?? {};
  if (extras.includes("stage")) checks.push(["your stage", filled(d.stage as string)]);
  if (extras.includes("problems")) checks.push(["the problems you are solving", filled(d.problems as string)]);
  if (extras.includes("lab")) checks.push(["your lab or department", filled(d.lab as string)]);
  if (extras.includes("hiringFocus")) checks.push(["who you are hiring", filled(d.hiring_focus as string)]);

  const done = checks.filter(([, ok]) => ok).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}
