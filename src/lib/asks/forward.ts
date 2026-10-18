import { createClient } from "@/lib/supabase/server";
import { hashToken, isWellFormedToken } from "./token";

export type ForwardView = {
  ask_id: string;
  asker_first_name: string;
  goal: string | null;
  target_company: string | null;
  message: string;
  work_url: string | null;
  expires_at: string;
  status: "forwarded" | "replied";
};

/** Public lookup by token. Returns null for anything malformed, unknown or expired. */
export async function lookupForward(token: string): Promise<ForwardView | null> {
  if (!isWellFormedToken(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_forward", { p_hash: hashToken(token) });
  if (error || !data?.length) return null;
  return data[0] as ForwardView;
}

/** One-tap reply. True only the first time, while the link is live. */
export async function replyToForward(token: string, note?: string): Promise<boolean> {
  if (!isWellFormedToken(token)) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reply_forward", {
    p_hash: hashToken(token),
    p_note: note ?? null,
  });
  return !error && data === true;
}
