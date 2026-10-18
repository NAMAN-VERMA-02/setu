import { z } from "zod";

export const successSchema = z.object({
  company: z.string().trim().max(120).optional(),
});

export const answerSchema = z.object({
  juniorId: z.uuid(),
  answer: z.string().trim().min(1, "Write a short answer").max(1000, "Keep it under 1,000 characters"),
});

/** Body of GET /api/payitforward. */
export type PayItForwardResponse = {
  succeeded: boolean;
  company: string | null;
  helpOwed: number;
  answered: number;
  candidates: {
    id: string;
    displayName: string;
    batch: number;
    branch: string;
    goalTarget: string | null;
    question: string;
    semester: number;
    firstLine: string;
  }[];
  received: { id: string; question: string | null; answer: string | null; helper: { batch: number | null; branch: string | null }; createdAt: string }[];
};
