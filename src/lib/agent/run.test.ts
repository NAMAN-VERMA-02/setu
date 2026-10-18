import { describe, expect, it } from "vitest";
import type { AgentSession, AgentTurn, ToolCall, ToolResult } from "@/lib/llm/agent-session";
import type { Match } from "@/lib/scoring";
import type { MatchResponse } from "@/lib/scoring/response";
import { MAX_TOOL_CALLS, MAX_TURNS, runDraftAgent, type AgentDeps } from "./run";

const match = (id: string, over: Partial<Match> = {}): Match => ({
  id,
  displayName: `Senior ${id}`,
  batch: 2024,
  branch: "CSE",
  semester: 5,
  score: 80,
  rarityBonus: 4,
  sharedTraits: ["tier", "backlogs"],
  firstLine: "You also had 1 backlog in semester 5.",
  routes: [
    { type: "direct", hops: 1, rank: 80 },
    { type: "via_senior", hops: 2, rank: 48, company: "Cognizant", contactCount: 3 },
  ],
  rank: 80,
  ...over,
});

const body = (bridgeBlocked = false): MatchResponse => ({
  semester: 5,
  total: 2,
  bridgeBlocked,
  routeMap: { total: 2, branches: [] },
  matches: [match("a"), match("b")],
});

type Turn = ToolCall[] | { stop: "refusal" | "max_tokens" | "end" };

const call = (id: string, name: string, input: unknown): ToolCall => ({ id, name, input });

/** A scripted model: each call to next() returns the next turn and records what it was sent. */
function script(turns: Turn[]) {
  const received: (ToolResult[] | null)[] = [];
  let i = 0;
  const session: AgentSession = {
    async next(results) {
      received.push(results);
      const turn = turns[Math.min(i++, turns.length - 1)];
      const out: AgentTurn = Array.isArray(turn)
        ? { stop: "tool_use", calls: turn, usage: { input: 100, output: 50 } }
        : { stop: turn.stop, calls: [], usage: { input: 100, output: 50 } };
      return out;
    },
  };
  return { session, received };
}

const deps = (session: AgentSession, over: Partial<AgentDeps> = {}): AgentDeps => ({
  session,
  getJourney: async () => ({ goal: { target: "SDE at Cognizant" }, semesters: [] }),
  getMatches: async () => ({ ok: true, body: body() }),
  ...over,
});

const good = {
  drafts: [{ match_id: "a", route: "bridge", message: "How did you prepare for the online test?", why: "Shares a backlog" }],
};

describe("runDraftAgent", () => {
  it("reads the journey and matches, then submits checked drafts", async () => {
    const { session, received } = script([
      [call("t1", "get_my_journey", {})],
      [call("t2", "find_matches", {})],
      [call("t3", "submit_drafts", good)],
    ]);
    const r = await runDraftAgent(deps(session));
    expect(r.status).toBe("ok");
    expect(r.turns).toBe(3);
    expect(r.toolCalls).toBe(3);
    expect(r.drafts).toHaveLength(1);
    expect(r.drafts[0].route).toBe("bridge");
    expect(r.drafts[0].targetCompany).toBe("Cognizant");
    expect(r.drafts[0].message.startsWith("You also had 1 backlog")).toBe(true);
    expect(r.inputTokens).toBe(300);
    // The first turn starts the conversation; later turns pass the tool results back.
    expect(received[0]).toBeNull();
    expect(received[1]?.[0]).toMatchObject({ id: "t1", name: "get_my_journey" });
  });

  it("gives the model one chance to fix rejected drafts", async () => {
    const bad = { drafts: [{ match_id: "a", route: "direct", message: "Can you refer me please?", why: "x" }] };
    const { session } = script([
      [call("t1", "find_matches", {})],
      [call("t2", "submit_drafts", bad)],
      [call("t3", "submit_drafts", good)],
    ]);
    const r = await runDraftAgent(deps(session));
    expect(r.status).toBe("ok");
    expect(r.drafts).toHaveLength(1);
  });

  it("stops after a second failed attempt and reports why", async () => {
    const bad = { drafts: [{ match_id: "a", route: "direct", message: "Can you refer me please?", why: "x" }] };
    const { session } = script([[call("t1", "find_matches", {})], [call("t2", "submit_drafts", bad)], [call("t3", "submit_drafts", bad)]]);
    const r = await runDraftAgent(deps(session));
    expect(r.status).toBe("ok");
    expect(r.drafts).toEqual([]);
    expect(r.rejected[0].reason).toMatch(/never for a referral/);
  });

  it("rejects drafts for seniors that find_matches never returned", async () => {
    const forged = { drafts: [{ match_id: "not-a-match", route: "direct", message: "Hello there?", why: "x" }] };
    const { session } = script([[call("t1", "find_matches", {})], [call("t2", "submit_drafts", forged)], [call("t3", "submit_drafts", forged)]]);
    const r = await runDraftAgent(deps(session));
    expect(r.drafts).toEqual([]);
  });

  it("does not offer a bridge when the student already has one open", async () => {
    const { session } = script([[call("t1", "find_matches", {})], [call("t2", "submit_drafts", good)], [call("t3", "submit_drafts", good)]]);
    const r = await runDraftAgent(deps(session, { getMatches: async () => ({ ok: true, body: body(true) }) }));
    expect(r.drafts).toEqual([]);
  });

  it("reports a refusal and a missing submission", async () => {
    expect((await runDraftAgent(deps(script([{ stop: "refusal" }]).session))).status).toBe("refused");
    expect((await runDraftAgent(deps(script([{ stop: "end" }]).session))).status).toBe("invalid");
  });

  it("is cut off by the turn and tool-call limits", async () => {
    const loop = script([[call("t", "get_my_journey", {})]]);
    const r = await runDraftAgent(deps(loop.session));
    expect(r.status).toBe("limit");
    expect(r.turns).toBeLessThanOrEqual(MAX_TURNS);
    expect(r.toolCalls).toBeLessThanOrEqual(MAX_TOOL_CALLS + 1);

    const many = script([Array.from({ length: MAX_TOOL_CALLS + 2 }, (_, i) => call(`t${i}`, "get_my_journey", {}))]);
    expect((await runDraftAgent(deps(many.session))).status).toBe("limit");
  });

  it("passes tool errors back to the model instead of crashing", async () => {
    const { session, received } = script([[call("t1", "find_matches", {})], [call("t2", "submit_drafts", { drafts: [] })]]);
    const r = await runDraftAgent(deps(session, { getMatches: async () => ({ ok: false, error: "Share your journey first." }) }));
    expect(r.status).toBe("ok");
    expect(received[1]?.[0]).toMatchObject({ isError: true });
  });
});
