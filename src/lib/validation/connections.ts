import { z } from "zod";

export const connectSchema = z.object({
  userId: z.uuid(),
  message: z.string().trim().max(300).optional(),
});

export const respondSchema = z.object({ action: z.enum(["accept", "decline"]) });
