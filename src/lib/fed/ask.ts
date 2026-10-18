import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createAgentSession, type AgentTurn, type NeutralTool, type ToolResult } from "@/lib/llm/agent-session";
import { fedLlmConfig } from "./llm";
import { ASK_SYSTEM, dedupeCards, extractCards, planOffline, templateAnswer, type AskCard, type TraceEntry } from "./ask-core";
import { configuredNodes, type NodeConfig, type NodeId } from "./config";
import { offlineNodeIds } from "./server";

export type AskResult = { answer: string; trace: TraceEntry[]; cards: AskCard[]; mode: "ai" | "offline"; offline: string[] };

type Connected = { cfg: NodeConfig; client: Client; tools: { name: string; description?: string; inputSchema: Record<string, unknown> }[] };

const MAX_ROUNDS = 5;
const AI_BUDGET_MS = 10_000; // after this the keyword router answers instead
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; result: AskResult }>();

async function connect(cfg: NodeConfig): Promise<Connected | null> {
  try {
    const client = new Client({ name: "setu-hub", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(cfg.mcpUrl), {
      requestInit: { headers: { authorization: `Bearer ${cfg.mcpToken}` } },
    });
    await Promise.race([client.connect(transport), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))]);
    const { tools } = await client.listTools();
    return { cfg, client, tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema as Record<string, unknown> })) };
  } catch {
    return null;
  }
}

async function callTool(conn: Connected, tool: string, args: Record<string, unknown>, trace: TraceEntry[]): Promise<Record<string, unknown> | null> {
  const started = Date.now();
  const node = conn.cfg.id;
  try {
    const res = await conn.client.callTool({ name: tool, arguments: args });
    const ms = Date.now() - started;
    const data = (res.structuredContent as Record<string, unknown> | undefined) ?? null;
    if (res.isError) {
      const text = Array.isArray(res.content) ? res.content.map((c) => ("text" in c ? String(c.text) : "")).join(" ") : "error";
      trace.push({ node, tool, args, ms, identifyingFields: 0, ok: false, error: text });
      return null;
    }
    trace.push({ node, tool, args, ms, identifyingFields: Number(data?.identifying_fields ?? 0), ok: true });
    return data;
  } catch (e) {
    trace.push({ node, tool, args, ms: Date.now() - started, identifyingFields: 0, ok: false, error: e instanceof Error ? e.message : "failed" });
    return null;
  }
}

async function runOffline(question: string, conns: Connected[], offline: string[], trace: TraceEntry[]): Promise<AskResult> {
  const planned = planOffline(question);
  const cards: AskCard[] = [];
  const stats: Record<string, unknown> = {};
  await Promise.all(
    conns.flatMap((c) =>
      planned.map(async (p) => {
        const data = await callTool(c, p.tool, p.args, trace);
        if (!data) return;
        if (p.tool === "college_stats") stats[c.cfg.id] = data.stats;
        cards.push(...extractCards(c.cfg.id, data));
      }),
    ),
  );
  const unique = dedupeCards(cards);
  return { answer: templateAnswer(unique, stats, offline), trace, cards: unique, mode: "offline", offline };
}

async function runAi(question: string, conns: Connected[], offline: string[], trace: TraceEntry[], deadline: number): Promise<AskResult | null> {
  const config = fedLlmConfig();
  if (!config) return null;
  const tools: NeutralTool[] = conns.flatMap((c) =>
    c.tools.map((t) => ({ name: `${c.cfg.id}__${t.name}`, description: `[${c.cfg.id.toUpperCase()}] ${t.description ?? ""}`, schema: t.inputSchema })),
  );
  const session = createAgentSession({ config, system: ASK_SYSTEM, tools, firstMessage: question, maxOutputTokens: 700 });
  const byNode = new Map<string, Connected>(conns.map((c) => [c.cfg.id, c]));
  const cards: AskCard[] = [];

  let results: ToolResult[] | null = null;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const left = deadline - Date.now();
    if (left <= 0) return null;
    const turn: AgentTurn | null = await Promise.race<AgentTurn | null>([session.next(results), new Promise<null>((r) => setTimeout(() => r(null), left))]);
    if (!turn || turn.stop === "refusal" || turn.stop === "max_tokens") return null;
    if (turn.stop === "end") {
      if (!turn.text) return null;
      const unique = dedupeCards(cards);
      return { answer: turn.text, trace, cards: unique, mode: "ai", offline };
    }
    results = await Promise.all(
      turn.calls.map(async (call): Promise<ToolResult> => {
        const [node, ...rest] = call.name.split("__");
        const conn = byNode.get(node);
        if (!conn) return { id: call.id, name: call.name, content: "Unknown tool", isError: true };
        const data = await callTool(conn, rest.join("__"), (call.input as Record<string, unknown>) ?? {}, trace);
        if (!data) return { id: call.id, name: call.name, content: "This college could not answer right now.", isError: true };
        cards.push(...extractCards(node, data));
        return { id: call.id, name: call.name, content: JSON.stringify(data) };
      }),
    );
  }
  return null;
}

/**
 * Ask Setu: Gemini (or Claude) drives MCP tool calls against every online college's own server.
 * We run the tool loop ourselves (at most 5 rounds, 10 s for the AI), then fall back to a keyword router.
 */
export async function ask(question: string): Promise<AskResult> {
  const key = question.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS && hit.result.mode === "ai") return hit.result;

  const offlineNodes = await offlineNodeIds();
  const configured = configuredNodes().filter((n) => !offlineNodes.has(n.id as NodeId));
  const connected = (await Promise.all(configured.map(connect))).filter((c): c is Connected => c !== null);
  const offline = (["ngit", "rce", "pro"] as const).filter((id) => configuredNodes().some((n) => n.id === id) && !connected.some((c) => c.cfg.id === id));

  try {
    if (connected.length === 0) return { answer: "No college server is reachable right now.", trace: [], cards: [], mode: "offline", offline };
    const trace: TraceEntry[] = [];
    const ai = await runAi(question, connected, offline, trace, Date.now() + AI_BUDGET_MS).catch(() => null);
    if (ai) {
      cache.set(key, { at: Date.now(), result: ai });
      return ai;
    }
    // the AI was unavailable or slow: answer from the same tools with the keyword router
    return await runOffline(question, connected, offline, trace);
  } finally {
    await Promise.all(connected.map((c) => c.client.close().catch(() => {})));
  }
}
