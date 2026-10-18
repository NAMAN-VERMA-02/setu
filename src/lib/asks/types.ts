import type { TrustStep } from "./trust";

export type AskStatus = "pending" | "forwarded" | "replied" | "accepted" | "declined" | "expired" | "cancelled";

type AskBase = {
  id: string;
  kind: "direct" | "bridge";
  trustStep: TrustStep;
  status: AskStatus;
  message: string;
  targetCompany: string | null;
  workUrl: string | null;
  workSeen: boolean;
  forwarded: boolean;
  repliedAt: string | null;
  replyNote: string | null;
  expiresAt: string;
  createdAt: string;
  counterpart: { id: string; name: string | null };
};

export type SentAsk = AskBase;
export type ReceivedAsk = AskBase & { role: "via" | "target" };

/** Body of GET /api/asks. */
export type AsksResponse = { sent: SentAsk[]; received: ReceivedAsk[] };

export type ActionResult = { ok: boolean; error?: string; link?: string; expiresAt?: string };
