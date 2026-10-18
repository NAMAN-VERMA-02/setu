import { NextResponse, type NextRequest } from "next/server";
import type { ThreadItem } from "@/lib/messages/types";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** My conversations, most recent first. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { data: threads, error } = await supabase
    .from("threads")
    .select("id, user_a, user_b, last_message_at, last_preview, a_read_at, b_read_at")
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (error) return fail("We could not load your messages.", 500);

  const otherIds = (threads ?? []).map((t) => (t.user_a === user.id ? t.user_b : t.user_a) as string);
  const { data: people } = otherIds.length ? await supabase.from("users").select("id, full_name, role, headline").in("id", otherIds) : { data: [] };
  const personOf = new Map((people ?? []).map((p) => [p.id, p]));

  const out: ThreadItem[] = [];
  for (const t of threads ?? []) {
    const otherId = (t.user_a === user.id ? t.user_b : t.user_a) as string;
    const p = personOf.get(otherId);
    if (!p) continue;
    const readAt = t.user_a === user.id ? t.a_read_at : t.b_read_at;
    out.push({
      id: t.id,
      other: { id: p.id, name: p.full_name, role: p.role, headline: p.headline },
      preview: t.last_preview,
      lastMessageAt: t.last_message_at,
      unread: Boolean(t.last_preview) && new Date(t.last_message_at) > new Date(readAt),
    });
  }
  return NextResponse.json({ threads: out });
}

const openSchema = z.object({ userId: z.uuid() });

/** Open (or find) the conversation with someone I am connected to. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = openSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Choose someone to message.", 400);

  const { data, error } = await supabase.rpc("open_thread", { p_other: parsed.data.userId });
  if (error) {
    if (/connect first/.test(error.message)) return fail("Connect with them first.", 403);
    return fail("We could not open that conversation.", 400);
  }
  return NextResponse.json({ threadId: data });
}
