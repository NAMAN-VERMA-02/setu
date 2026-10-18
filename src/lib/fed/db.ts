import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Service-role client for the hub tables. Throws a clear error when the key is missing. */
export function fedDb() {
  const db = createAdminClient();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return db;
}

/** Event text is shown on a projector and must never contain a person's name. */
export async function logEvent(kind: string, text: string, nodeId?: string, introId?: string) {
  await fedDb().rpc("fed_event", { p_kind: kind, p_text: text, p_node: nodeId ?? null, p_intro: introId ?? null });
}
