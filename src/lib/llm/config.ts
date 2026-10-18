export type ProviderName = "gemini" | "anthropic";

export type LlmConfig = { provider: ProviderName; apiKey: string; model: string };

const DEFAULT_MODELS: Record<ProviderName, string> = {
  gemini: "gemini-3.8-flash",
  anthropic: "claude-opus-5-5",
};

/** Reads the AI settings from the environment. Returns null when no key is set. */
export function readLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig | null {
  const apiKey = env.LLM_API_KEY?.trim();
  if (!apiKey) return null;
  const provider: ProviderName = env.LLM_PROVIDER === "anthropic" ? "anthropic" : "gemini";
  return { provider, apiKey, model: env.LLM_MODEL?.trim() || DEFAULT_MODELS[provider] };
}
