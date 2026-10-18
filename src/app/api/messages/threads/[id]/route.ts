import { NextResponse, type NextRequest } from "next/server";
import { messageError, type MessageItem } from "@/lib/messages/types";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const idSchema = z.uuid();
const sendSchema = z.object({ body: z.string().trim().min(1, "Write something first.").max(2000, "Keep it under 2000 characters.") });

/** The latest messages in one conversation. Opening it marks it read. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/messages/threads/[id]">) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return fail("Unknown conversation.", 404);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { data, error } = await supabase.from("messages").select("id, sender_id, body, created_at").eq("thread_id", id).order("created_at", { ascending: false }).limit(100);
  if (error) return fail("We could not load that conversation.", 500);

  await supabase.rpc("mark_thread_read", { p_thread: id });
  const messages: MessageItem[] = (data ?? []).reverse().map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }));
  return NextResponse.json({ messages });
}

/** Send a message. The database checks that you are connected. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/messages/threads/[id]">) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return fail("Unknown conversation.", 404);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write something first.", 400);

  const { data, error } = await supabase.from("messages").insert({ thread_id: id, sender_id: user.id, body: parsed.data.body }).select("id, sender_id, body, created_at").single();
  if (error || !data) {
    const e = messageError(error?.message ?? "");
    return fail(e.error, e.status);
  }
  const message: MessageItem = { id: data.id, senderId: data.sender_id, body: data.body, createdAt: data.created_at };
  return NextResponse.json({ message }, { status: 201 });
}
