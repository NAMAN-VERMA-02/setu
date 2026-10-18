import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import type { LlmConfig } from "./config";

/** A tool the model may call, described once and translated for each provider. */
export type NeutralTool = { name: string; description: string; schema: Record<string, unknown> };

export type ToolCall = { id: string; name: string; input: unknown };
export type ToolResult = { id: string; name: string; content: string; isError?: boolean };

export type AgentTurn = {
  stop: "tool_use" | "end" | "refusal" | "max_tokens";
  calls: ToolCall[];
  usage: { input: number; output: number };
  /** The model's own words for this turn, when it wrote any (used by Ask Setu for the final answer). */
  text?: string;
};

/**
 * One conversation with a tool-using model. `next(null)` starts it; later calls pass the
 * results of the previous turn's tool calls. The session keeps its own history.
 */
export type AgentSession = { next: (results: ToolResult[] | null) => Promise<AgentTurn> };

type Options = { config: LlmConfig; system: string; tools: NeutralTool[]; firstMessage: string; maxOutputTokens: number };

export function anthropicTools(tools: NeutralTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.schema as Anthropic.Tool["input_schema"],
    strict: true,
  }));
}

export function geminiTools(tools: NeutralTool[]): FunctionDeclaration[] {
  return tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.schema }));
}

export function createAgentSession(opts: Options): AgentSession {
  return opts.config.provider === "anthropic" ? anthropicSession(opts) : geminiSession(opts);
}

function anthropicSession({ config, system, tools, firstMessage, maxOutputTokens }: Options): AgentSession {
  const client = new Anthropic({ apiKey: config.apiKey });
  const toolDefs = anthropicTools(tools);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: firstMessage }];

  return {
    async next(results) {
      if (results) {
        messages.push({
          role: "user",
          content: results.map<Anthropic.ToolResultBlockParam>((r) => ({
            type: "tool_result",
            tool_use_id: r.id,
            content: r.content,
            ...(r.isError ? { is_error: true } : {}),
          })),
        });
      }

      const response = await client.messages.create({
        model: config.model,
        max_tokens: maxOutputTokens,
        system,
        tools: toolDefs,
        output_config: { effort: "medium" },
        messages,
      });
      const usage = { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 };
      if (response.stop_reason === "refusal") return { stop: "refusal", calls: [], usage };
      if (response.stop_reason === "max_tokens") return { stop: "max_tokens", calls: [], usage };

      // Keep the whole assistant turn, including thinking blocks, so the model can continue.
      messages.push({ role: "assistant", content: response.content });
      const calls = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({ id: b.id, name: b.name, input: b.input }));
      const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      return { stop: calls.length ? "tool_use" : "end", calls, usage, ...(text ? { text } : {}) };
    },
  };
}

const BLOCKED = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION", "IMAGE_SAFETY"]);

function geminiSession({ config, system, tools, firstMessage, maxOutputTokens }: Options): AgentSession {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const declarations = geminiTools(tools);
  const contents: Content[] = [{ role: "user", parts: [{ text: firstMessage }] }];

  return {
    async next(results) {
      if (results) {
        contents.push({
          role: "user",
          parts: results.map((r) => ({
            functionResponse: { id: r.id, name: r.name, response: r.isError ? { error: r.content } : { output: r.content } },
          })),
        });
      }

      const response = await ai.models.generateContent({
        model: config.model,
        contents,
        config: { systemInstruction: system, tools: [{ functionDeclarations: declarations }], maxOutputTokens },
      });
      const usage = {
        input: response.usageMetadata?.promptTokenCount ?? 0,
        output: response.usageMetadata?.candidatesTokenCount ?? 0,
      };

      const candidate = response.candidates?.[0];
      const reason = String(candidate?.finishReason ?? "");
      if (response.promptFeedback?.blockReason || !candidate?.content || BLOCKED.has(reason)) {
        return { stop: "refusal", calls: [], usage };
      }
      if (reason === "MAX_TOKENS") return { stop: "max_tokens", calls: [], usage };

      // Echo the model's own turn back unchanged (it carries reasoning signatures).
      contents.push(candidate.content);
      const calls = (response.functionCalls ?? []).map((c, i) => ({
        id: c.id ?? `${c.name}-${contents.length}-${i}`,
        name: c.name ?? "",
        input: c.args ?? {},
      }));
      const text = candidate.content.parts?.map((p) => p.text ?? "").join("").trim();
      return { stop: calls.length ? "tool_use" : "end", calls, usage, ...(text ? { text } : {}) };
    },
  };
}
