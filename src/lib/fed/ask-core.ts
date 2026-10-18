/** Pure helpers for Ask Setu: the offline keyword router, card extraction and the templated answer. */

export type AskCard = { pid: string; node: string; title: string | null; company: string | null; gradYear: number | null; branch: string | null; score: number | null; outcome: string | null };
export type TraceEntry = { node: string; tool: string; args: Record<string, unknown>; ms: number; identifyingFields: number; ok: boolean; error?: string };
export type PlannedCall = { tool: string; args: Record<string, unknown> };

const BRANCHES = ["CSE", "IT", "ECE", "ME", "AIML"];
const COMPANIES = ["FinStack", "Nimbus Labs", "KoshaPay", "Tarang Systems", "Vayu Robotics", "Indus Health AI", "BharatGrid", "Quanta Retail", "Lumen Analytics", "Sarthi Mobility"];
const FINTECH = ["FinStack", "KoshaPay"];

/**
 * Chooses MCP calls from keywords when the AI is slow or unavailable. Works in English and Hinglish.
 * Returns calls without the college prefix; the caller runs them on every online college.
 */
export function planOffline(question: string): PlannedCall[] {
  const q = question.toLowerCase();
  const calls: PlannedCall[] = [];

  if (/\b(stats|statistics|kitne|how many|count|total|numbers?)\b/.test(q)) calls.push({ tool: "college_stats", args: {} });

  // "I need a developer", "mujhe ek designer chahiye": a plain-words need goes to the matcher on every server
  if (/\b(need|looking for|want|hire|chahiye|zaroorat|dhundh|dhoondh)\b/.test(q) && /developer|coder|programmer|designer|lawyer|doctor|accountant|marketer|engineer|founder|teacher|researcher|analyst/.test(q)) {
    calls.push({ tool: "match_need", args: { need: question.slice(0, 300), limit: 5 } });
    return calls;
  }

  const companies = COMPANIES.filter((c) => q.includes(c.toLowerCase()));
  if (/fintech|finance|payments?/.test(q)) companies.push(...FINTECH.filter((c) => !companies.includes(c)));
  const branch = BRANCHES.find((b) => new RegExp(`\\b${b.toLowerCase()}\\b`).test(q));
  const goal = /\bml\b|machine learning|data scien/.test(q) ? "ML engineer" : /product/.test(q) ? "product manager" : /gate|higher stud|m\.?tech|ms abroad/.test(q) ? "higher studies" : undefined;
  const wantsPeople = /alumni|senior|help|madad|intro|mentor|referral|who|kaun/.test(q) || companies.length > 0 || goal !== undefined || branch !== undefined;

  if (wantsPeople) {
    if (companies.length) for (const company of companies) calls.push({ tool: "find_helpers", args: { company, ...(branch ? { field: branch } : {}), limit: 5 } });
    else calls.push({ tool: "find_helpers", args: { ...(branch ? { field: branch } : {}), ...(goal ? { goal } : {}), limit: 5 } });
  }
  if (calls.length === 0) calls.push({ tool: "college_stats", args: {} });
  return calls;
}

type Json = Record<string, unknown>;

/** Turns a tool result into pseudonymous cards. `helpers` and `matches` are the two list shapes the nodes return. */
export function extractCards(node: string, result: Json | null): AskCard[] {
  if (!result) return [];
  const rows = [
    ...((result.helpers as Json[] | undefined) ?? []),
    ...((result.matches as Json[] | undefined) ?? []),
    ...((result.people as Json[] | undefined) ?? []), // from match_need
  ];
  return rows
    .filter((r) => typeof r.pid === "string")
    .map((r) => ({
      pid: r.pid as string,
      node,
      title: (r.title as string | null) ?? (r.now_title as string | null) ?? null,
      company: (r.company as string | null) ?? (r.now_company as string | null) ?? null,
      gradYear: (r.grad_year as number | null) ?? null,
      branch: (r.branch as string | null) ?? null,
      score: typeof r.score === "number" ? r.score : null,
      outcome: (r.outcome as string | null) ?? null,
    }));
}

export function dedupeCards(cards: AskCard[]): AskCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => (seen.has(c.pid) ? false : (seen.add(c.pid), true)));
}

const nodeName = (n: string) => (n === "pro" ? "Professional network" : n.toUpperCase());

export function cardLine(c: AskCard): string {
  const who = c.node === "pro" ? "Professional" : `${c.node.toUpperCase()} alum${c.gradYear ? ` ’${String(c.gradYear).slice(-2)}` : ""}`;
  const what = [c.title, c.company].filter(Boolean).join(", ");
  return what ? `${who} · ${what}` : who;
}

/** The answer used in offline mode. Never names anyone: results are pseudonymous. */
export function templateAnswer(cards: AskCard[], statsByNode: Record<string, unknown>, offline: string[]): string {
  const colleges = [...new Set(cards.map((c) => nodeName(c.node)))];
  const parts: string[] = [];
  if (cards.length) {
    parts.push(`Found ${cards.length} ${cards.length === 1 ? "person" : "people"} across ${colleges.join(" and ")} who can help:`);
    parts.push(...cards.slice(0, 6).map((c) => `• ${cardLine(c)}`));
    parts.push("Their names stay on their college’s server. Use “Ask for intro” and Setu will find the warmest route.");
  } else if (Object.keys(statsByNode).length) {
    parts.push("Here are the college numbers I could read (counts only):");
    for (const [node, s] of Object.entries(statsByNode)) parts.push(`• ${node.toUpperCase()}: ${JSON.stringify(s).slice(0, 220)}`);
  } else {
    parts.push("I could not find anyone matching that. Try naming a company, a branch like ECE, or a goal like ML.");
  }
  if (offline.length) parts.push(`${offline.map(nodeName).join(", ")} is offline, so its people are not included.`);
  return parts.join("\n");
}

export const ASK_SYSTEM = `You are Setu's assistant for a federated alumni network. Each college runs its own server that you can query through tools.
- Answer in the user's language (Hinglish is fine). Keep it short.
- Use the tools. Never invent people, companies or numbers.
- Results are pseudonymous: never ask for or guess names. Refer to people as "NGIT alum ’22, ML Engineer at FinStack".
- To suggest an intro, tell the user to press "Ask for intro" on a card. Never claim an intro was sent.
- Query every relevant college's tools before answering.`;
