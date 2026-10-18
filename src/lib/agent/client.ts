import type { CheckedDraft } from "./guardrails";

export type DraftsResponse = { drafts: CheckedDraft[]; notes: string[] };

export async function requestDrafts(): Promise<{ data?: DraftsResponse; error?: string }> {
  try {
    const res = await fetch("/api/agent/drafts", { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as Partial<DraftsResponse> & { error?: string };
    if (!res.ok) return { error: json.error ?? "We could not draft messages. Please try again." };
    return { data: { drafts: json.drafts ?? [], notes: json.notes ?? [] } };
  } catch {
    return { error: "Could not reach SETU. Check your connection and try again." };
  }
}
