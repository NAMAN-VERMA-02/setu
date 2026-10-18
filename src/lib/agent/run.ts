import type { AgentSession, ToolResult } from "@/lib/llm/agent-session";
import type { MatchResponse } from "@/lib/scoring/response";
import {
  MAX_DRAFTS,
  checkDrafts,
  sanitizeUntrusted,
  type AgentMatch,
  type CheckedDraft,
  type RawDraft,
  type Rejection,
} from "./guardrails";
import { USER_PROMPT } from "./prompt";
import { matchSummary } from "./tools";

/** Hard limits: the agent can neither loop forever nor spend without bound. */
export const MAX_TURNS = 6;
export const MAX_TOOL_CALLS = 8;
export const MAX_OUTPUT_TOKENS = 6000;

export type AgentStatus = "ok" | "refused" | "invalid" | "limit" | "error";

export type AgentResult = {
  status: AgentStatus;
  drafts: CheckedDraft[];
  rejected: Rejection[];
  turns: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
};

export type AgentDeps = {
  /** The model conversation. Provider-specific details live behind this. */
  session: AgentSession;
  /** Already sanitised summary of the student's own journey. */
  getJourney: () => Promise<unknown>;
  getMatches: () => Promise<{ ok: true; body: MatchResponse } | { ok: false; error: string }>;
};

const json = (value: unknown) => JSON.stringify(value);

/** What the first message to the model says; kept here so the session can be built with it. */
export const FIRST_MESSAGE = USER_PROMPT;

/**
 * Tool-using loop that drafts first messages. It reads (journey, matches) and proposes
 * (submit_drafts); it can never send anything. Every proposal passes the guardrails.
 */
export async function runDraftAgent(deps: AgentDeps): Promise<AgentResult> {
  const result: AgentResult = { status: "error", drafts: [], rejected: [], turns: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 };

  const allowed = new Map<string, AgentMatch>();
  let bridgeBlocked = false;
  let retried = false;
  let results: ToolResult[] | null = null;

  while (result.turns < MAX_TURNS) {
    result.turns += 1;
    const turn = await deps.session.next(results);
    result.inputTokens += turn.usage.input;
    result.outputTokens += turn.usage.output;

    if (turn.stop === "refusal") return { ...result, status: "refused" };
    if (turn.stop === "max_tokens") return { ...result, status: "limit" };
    if (turn.calls.length === 0) return { ...result, status: "invalid" };

    const replies: ToolResult[] = [];
    let finished = false;

    for (const call of turn.calls) {
      result.toolCalls += 1;
      if (result.toolCalls > MAX_TOOL_CALLS) return { ...result, status: "limit" };
      const reply = (content: string, isError = false): ToolResult => ({ id: call.id, name: call.name, content, ...(isError ? { isError: true } : {}) });

      if (call.name === "get_my_journey") {
        replies.push(reply(json(await deps.getJourney())));
      } else if (call.name === "find_matches") {
        const found = await deps.getMatches();
        if (!found.ok) {
          replies.push(reply(json({ error: found.error }), true));
          continue;
        }
        bridgeBlocked = found.body.bridgeBlocked;
        const top = found.body.matches.slice(0, 5);
        for (const m of top) {
          allowed.set(m.id, {
            id: m.id,
            displayName: sanitizeUntrusted(m.displayName, 80),
            firstLine: sanitizeUntrusted(m.firstLine, 160),
            routes: m.routes,
          });
        }
        const summary = matchSummary(top).map((s) => ({ ...s, first_line: allowed.get(s.id)?.firstLine ?? s.first_line }));
        replies.push(reply(json({ total_matches: found.body.total, bridge_available: !found.body.bridgeBlocked, matches: summary })));
      } else if (call.name === "submit_drafts") {
        const raw = ((call.input as { drafts?: RawDraft[] }).drafts ?? []).slice(0, MAX_DRAFTS + 3);
        const { accepted, rejected } = checkDrafts(raw, allowed, { bridgeBlocked });

        if (accepted.length === 0 && rejected.length > 0 && !retried && result.turns < MAX_TURNS) {
          // One chance to fix the problems the guardrails found.
          retried = true;
          replies.push(reply(json({ problems: rejected.map((r) => r.reason), instruction: "Fix these and call submit_drafts again." }), true));
        } else {
          result.drafts = accepted;
          result.rejected = rejected;
          finished = true;
          replies.push(reply("Received."));
        }
      } else {
        replies.push(reply(json({ error: "Unknown tool." }), true));
      }
    }

    if (finished) return { ...result, status: "ok" };
    results = replies;
  }

  return { ...result, status: "limit" };
}
