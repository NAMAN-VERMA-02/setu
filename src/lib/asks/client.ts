import type { ActionResult, AsksResponse } from "./types";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const NETWORK_ERROR = "Could not reach SETU. Check your connection and try again.";

export async function loadAsks(): Promise<{ data?: AsksResponse; error?: string }> {
  try {
    const res = await fetch("/api/asks");
    const json = await readJson(res);
    if (!res.ok) return { error: (json.error as string) ?? "Could not load your requests." };
    return { data: json as unknown as AsksResponse };
  } catch {
    return { error: NETWORK_ERROR };
  }
}

export async function createAsk(body: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await fetch("/api/asks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await readJson(res);
    return res.ok ? { ok: true } : { ok: false, error: (json.error as string) ?? "Could not send your request." };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

export async function patchAsk(id: string, body: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await fetch(`/api/asks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await readJson(res);
    if (!res.ok) return { ok: false, error: (json.error as string) ?? "That did not work. Please try again." };
    return { ok: true, link: json.link as string | undefined, expiresAt: json.expiresAt as string | undefined };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}
