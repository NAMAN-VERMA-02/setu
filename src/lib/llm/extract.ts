import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { LlmConfig } from "./config";

export type ExtractResult<T> = { ok: true; data: T } | { ok: false; reason: "refused" | "invalid" | "unavailable" };

type Input<T> = {
  config: LlmConfig;
  system: string;
  /** The user's PDF, processed in memory and never stored. */
  pdf: Buffer;
  text: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
};

/** JSON Schema in the shape Gemini accepts (no $schema marker). */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _ignored;
  return rest;
}

/** Reads a PDF with the configured model and returns data that has been validated against `schema`. */
export async function extractFromPdf<T>(input: Input<T>): Promise<ExtractResult<T>> {
  const { config, system, pdf, text, schema, maxTokens = 8000 } = input;

  try {
    if (config.provider === "anthropic") {
      const client = new Anthropic({ apiKey: config.apiKey });
      const response = await client.messages.parse({
        model: config.model,
        max_tokens: maxTokens,
        system,
        output_config: { effort: "low", format: zodOutputFormat(schema) },
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
              { type: "text", text },
            ],
          },
        ],
      });
      if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
      const checked = schema.safeParse(response.parsed_output);
      return checked.success ? { ok: true, data: checked.data } : { ok: false, reason: "invalid" };
    }

    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({
      model: config.model,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } }, { text }],
        },
      ],
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(schema),
      },
    });
    if (response.promptFeedback?.blockReason) return { ok: false, reason: "refused" };
    const raw = response.text;
    if (!raw) return { ok: false, reason: "invalid" };
    const checked = schema.safeParse(JSON.parse(raw));
    return checked.success ? { ok: true, data: checked.data } : { ok: false, reason: "invalid" };
  } catch (error) {
    console.error("extractFromPdf failed", error instanceof Error ? error.message : error);
    return { ok: false, reason: error instanceof SyntaxError ? "invalid" : "unavailable" };
  }
}
