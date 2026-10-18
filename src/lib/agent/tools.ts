import type { NeutralTool } from "@/lib/llm/agent-session";
import type { Match } from "@/lib/scoring";
import { sanitizeUntrusted } from "./guardrails";

export const TOOLS: NeutralTool[] = [
  {
    name: "get_my_journey",
    description:
      "The student's own goal and their semester-by-semester journey (skills, what they were doing, direction, backlogs).",
    schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "find_matches",
    description:
      "Seniors from the student's college who were in the same semester as the student is now, best matches first. Each has an id, a first_line to open with, what they share, and the routes available (direct, or via_senior with a company).",
    schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "submit_drafts",
    description:
      "Submit up to three drafted first messages, one per senior. This ends the task. The student reviews them before anything is sent.",
    schema: {
      type: "object",
      properties: {
        drafts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              match_id: { type: "string", description: "The id of the senior, exactly as returned by find_matches." },
              route: { type: "string", enum: ["direct", "bridge"] },
              message: { type: "string", description: "The message, starting with the senior's first_line." },
              why: { type: "string", description: "One short sentence on why this senior is a good fit." },
            },
            required: ["match_id", "route", "message", "why"],
            additionalProperties: false,
          },
        },
      },
      required: ["drafts"],
      additionalProperties: false,
    },
  },
];

type JourneyRows = {
  goal: { target: string | null; company: string | null; open_question: string | null } | null;
  snapshots: {
    semester: number;
    cgpa_range: string | null;
    backlog_count: number;
    skills: string[] | null;
    status: string | null;
    decision: string | null;
  }[];
};

/** The student's own journey, with every free-text field cleaned before the model sees it. */
export function journeySummary({ goal, snapshots }: JourneyRows) {
  return {
    goal: goal
      ? {
          target: sanitizeUntrusted(goal.target),
          company: sanitizeUntrusted(goal.company, 120),
          open_question: sanitizeUntrusted(goal.open_question, 300),
        }
      : null,
    semesters: snapshots.map((s) => ({
      semester: s.semester,
      cgpa_range: s.cgpa_range,
      backlogs: s.backlog_count,
      skills: (s.skills ?? []).slice(0, 12).map((k) => sanitizeUntrusted(k, 40)),
      status: sanitizeUntrusted(s.status),
      direction: s.decision,
    })),
  };
}

/** A compact view of the top matches. No marks beyond what each senior agreed to show. */
export function matchSummary(matches: Match[], limit = 5) {
  return matches.slice(0, limit).map((m) => ({
    id: m.id,
    name: sanitizeUntrusted(m.displayName, 80),
    batch: m.batch,
    branch: sanitizeUntrusted(m.branch, 60),
    match_score: m.score,
    first_line: m.firstLine,
    shares: m.sharedTraits.filter((t) => t !== "tier"),
    routes: m.routes.map((r) =>
      r.type === "direct" ? { type: "direct" } : { type: "via_senior", company: sanitizeUntrusted(r.company, 80), contacts: r.contactCount },
    ),
  }));
}
