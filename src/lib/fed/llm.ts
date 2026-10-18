import "server-only";
import { readLlmConfig, type LlmConfig } from "@/lib/llm/config";

/**
 * AI settings for the Live Network. Demo screens need answers in about a second, so Gemini defaults to a
 * flash-lite model (measured about 0.8 s per tool-calling turn against about 3 to 10 s for the larger flash).
 * Override with FED_LLM_MODEL. The campus app keeps using LLM_MODEL.
 */
export function fedLlmConfig(): LlmConfig | null {
  const base = readLlmConfig();
  if (!base) return null;
  const override = process.env.FED_LLM_MODEL?.trim();
  if (override) return { ...base, model: override };
  return base.provider === "gemini" ? { ...base, model: "gemini-3.5-flash-lite" } : base;
}
