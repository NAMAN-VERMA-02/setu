import type { Match } from "@/lib/scoring";

export const MAX_DRAFTS = 3;
export const MAX_MESSAGE_CHARS = 700;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_LIKE = /\b(?:https?:\/\/|www\.)\S+/gi;
// Seven or more digits, allowing spaces, dashes and a leading plus: phone-number shaped.
const PHONE = /(?:\+?\d[\s-]?){7,}/g;

/** Referral language: a first message may only ask a question. */
const REFERRAL = /\b(refer(?:ral|rals)?|refer me|put in a (?:good )?word|recommend me|get me (?:a|the) (?:job|interview)|hire me)\b/i;

/** Removes anything that could identify or contact a person. */
export function redact(text: string): string {
  return text.replace(EMAIL, "[removed]").replace(URL_LIKE, "[removed]").replace(PHONE, "[removed]");
}

/** Cleans text that came from users before the model sees it (data, never instructions). */
export function sanitizeUntrusted(text: string | null | undefined, max = 200): string {
  if (!text) return "";
  const noControl = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ");
  return redact(noControl).replace(/\s+/g, " ").trim().slice(0, max);
}

export type AgentMatch = Pick<Match, "id" | "displayName" | "firstLine" | "routes">;

export type RawDraft = { match_id: string; route: string; message: string; why?: string };

export type CheckedDraft = {
  matchId: string;
  displayName: string;
  route: "direct" | "bridge";
  targetCompany: string | null;
  message: string;
  why: string;
};

export type Rejection = { matchId: string; reason: string };

/**
 * Deterministic checks on whatever the model proposes. The model can be wrong or manipulated;
 * these rules do not depend on it behaving.
 */
export function checkDrafts(
  raw: RawDraft[],
  allowed: Map<string, AgentMatch>,
  opts: { bridgeBlocked: boolean; max?: number },
): { accepted: CheckedDraft[]; rejected: Rejection[] } {
  const accepted: CheckedDraft[] = [];
  const rejected: Rejection[] = [];
  const seen = new Set<string>();
  const max = opts.max ?? MAX_DRAFTS;

  for (const d of raw) {
    const reject = (reason: string) => rejected.push({ matchId: String(d.match_id), reason });

    const match = allowed.get(d.match_id);
    if (!match) {
      reject("That is not one of your matches.");
      continue;
    }
    if (seen.has(d.match_id)) {
      reject("Only one draft per senior.");
      continue;
    }
    if (accepted.length >= max) {
      reject(`At most ${max} drafts at a time.`);
      continue;
    }

    const route = d.route === "bridge" ? "bridge" : d.route === "direct" ? "direct" : null;
    if (!route) {
      reject("Unknown route.");
      continue;
    }
    const via = match.routes.find((r) => r.type === "via_senior");
    if (route === "bridge" && (!via || via.type !== "via_senior" || opts.bridgeBlocked)) {
      reject("Passing a request on is not available for this senior right now.");
      continue;
    }

    let message = String(d.message ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
    if (redact(message) !== message) {
      reject("The draft contained contact details or a link.");
      continue;
    }
    if (REFERRAL.test(message)) {
      reject("A first message can only ask a question, never for a referral.");
      continue;
    }
    // Every first message opens with the rarest thing the two share.
    if (!message.startsWith(match.firstLine)) message = `${match.firstLine}\n\n${message}`;
    if (message.length > MAX_MESSAGE_CHARS) {
      reject(`The draft is longer than ${MAX_MESSAGE_CHARS} characters.`);
      continue;
    }
    if ((message.match(/\?/g) ?? []).length !== 1) {
      reject("A first message asks exactly one question.");
      continue;
    }

    seen.add(d.match_id);
    accepted.push({
      matchId: d.match_id,
      displayName: match.displayName,
      route,
      targetCompany: route === "bridge" && via?.type === "via_senior" ? via.company : null,
      message,
      why: sanitizeUntrusted(d.why, 200),
    });
  }

  return { accepted, rejected };
}
