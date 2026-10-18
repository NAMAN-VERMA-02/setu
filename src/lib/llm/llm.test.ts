import { describe, expect, it } from "vitest";
import { z } from "zod";
import { TOOLS } from "@/lib/agent/tools";
import { anthropicTools, geminiTools } from "./agent-session";
import { readLlmConfig } from "./config";
import { toGeminiSchema } from "./extract";

describe("readLlmConfig", () => {
  it("is off without a key", () => {
    expect(readLlmConfig({})).toBeNull();
    expect(readLlmConfig({ LLM_API_KEY: "  " })).toBeNull();
  });
  it("defaults to Gemini and lets the environment override provider and model", () => {
    expect(readLlmConfig({ LLM_API_KEY: "k" })).toMatchObject({ provider: "gemini", apiKey: "k" });
    expect(readLlmConfig({ LLM_API_KEY: "k", LLM_PROVIDER: "anthropic" })?.provider).toBe("anthropic");
    expect(readLlmConfig({ LLM_API_KEY: "k", LLM_MODEL: "my-model" })?.model).toBe("my-model");
  });
});

describe("tool translation", () => {
  it("describes the same three tools for both providers", () => {
    const names = TOOLS.map((t) => t.name);
    expect(anthropicTools(TOOLS).map((t) => t.name)).toEqual(names);
    expect(geminiTools(TOOLS).map((t) => t.name)).toEqual(names);
    expect(geminiTools(TOOLS)[2].parametersJsonSchema).toEqual(TOOLS[2].schema);
  });
  it("has no send tool", () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual(["find_matches", "get_my_journey", "submit_drafts"]);
  });
});

describe("toGeminiSchema", () => {
  it("returns a plain JSON schema without the $schema marker", () => {
    const out = toGeminiSchema(z.object({ a: z.string(), b: z.array(z.number()) })) as Record<string, unknown>;
    expect(out.$schema).toBeUndefined();
    expect(out.type).toBe("object");
  });
});
