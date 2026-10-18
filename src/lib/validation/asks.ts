import { z } from "zod";

const message = z.string().trim().min(1, "Write a short message").max(2000);

export const createAskSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("direct"), targetId: z.uuid(), message }),
  z.object({
    kind: z.literal("bridge"),
    viaId: z.uuid(),
    targetCompany: z.string().trim().min(1, "Choose a company").max(120),
    message,
  }),
]);

export const patchAskSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("decline") }),
  z.object({ action: z.literal("advance") }),
  z.object({ action: z.literal("mark_work_seen") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("forward") }),
  z.object({
    action: z.literal("submit_work"),
    workUrl: z.url({ protocol: /^https$/, error: "Use an https link" }).max(500),
  }),
]);

export const replySchema = z.object({ note: z.string().trim().max(500).optional() });

export type CreateAskInput = z.infer<typeof createAskSchema>;
export type PatchAskInput = z.infer<typeof patchAskSchema>;
