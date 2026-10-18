import { NextResponse } from "next/server";
import { journeySummary } from "@/lib/agent/tools";
import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { FIRST_MESSAGE, MAX_OUTPUT_TOKENS, runDraftAgent, type AgentResult, type AgentStatus } from "@/lib/agent/run";
import { TOOLS } from "@/lib/agent/tools";
import { createAgentSession } from "@/lib/llm/agent-session";
import { readLlmConfig } from "@/lib/llm/config";
import { computeMatches } from "@/lib/match/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const RUNS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const STATUS_MESSAGES: Partial<Record<AgentStatus, { status: number; error: string }>> = {
  refused: { status: 422, error: "We could not draft messages this time. Write your own, or try again later." },
  invalid: { status: 502, error: "The assistant did not finish. Please try again." },
  limit: { status: 504, error: "That took too long. Please try again." },
  error: { status: 502, error: "The assistant is unavailable right now. Write your own message for now." },
};

/**
 * Drafts first messages for the student's best matches. Read-only: nothing is sent here.
 * The student reviews every draft and sends it through the normal ask flow.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const config = readLlmConfig();
  const admin = createAdminClient();
  if (!config || !admin) return fail("Message drafting is not configured yet.", 503);

  // Give to get: no drafts before the student has shared their own journey.
  const { count: journeyCount } = await supabase
    .from("snapshots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!journeyCount) return fail("Share your journey first.", 409);

  // Database-backed limit, so it holds across servers and restarts.
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { count: recent } = await supabase
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gt("created_at", since);
  if ((recent ?? 0) >= RUNS_PER_HOUR) return fail("You have used all your drafts for now. Try again in an hour.", 429);

  let matchesOnce: ReturnType<typeof computeMatches> | null = null;
  const getMatches = async () => {
    matchesOnce ??= computeMatches(supabase, admin, user.id);
    const r = await matchesOnce;
    return r.ok ? { ok: true as const, body: r.body } : { ok: false as const, error: r.error };
  };

  let result: AgentResult;
  try {
    result = await runDraftAgent({
      session: createAgentSession({ config, system: SYSTEM_PROMPT, tools: TOOLS, firstMessage: FIRST_MESSAGE, maxOutputTokens: MAX_OUTPUT_TOKENS }),
      getMatches,
      getJourney: async () => {
        const [{ data: goal }, { data: snapshots }] = await Promise.all([
          supabase.from("goals").select("target, company, open_question").eq("user_id", user.id).maybeSingle(),
          supabase.from("snapshots").select("semester, cgpa_range, backlog_count, skills, status, decision").eq("user_id", user.id).order("semester"),
        ]);
        return journeySummary({ goal, snapshots: snapshots ?? [] });
      },
    });
  } catch (error) {
    console.error("draft agent failed", error instanceof Error ? error.message : error);
    result = { status: "error", drafts: [], rejected: [], turns: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 };
  }

  // Counts only: never the journey, the matches or the drafted text.
  await supabase.from("agent_runs").insert({
    user_id: user.id,
    status: result.status,
    turns: result.turns,
    tool_calls: result.toolCalls,
    drafts: result.drafts.length,
    rejected: result.rejected.length,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
  });

  const problem = STATUS_MESSAGES[result.status];
  if (problem) return fail(problem.error, problem.status);

  return NextResponse.json({
    drafts: result.drafts,
    notes: result.rejected.map((r) => r.reason),
  });
}
