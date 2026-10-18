import { NextResponse, type NextRequest } from "next/server";
import { announcementSchema, type AnnouncementItem } from "@/lib/validation/announcements";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Announcements and events for my college, newest first. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { data, error } = await supabase.from("announcements").select("id, kind, title, body, event_at, created_at, author_id").order("created_at", { ascending: false }).limit(50);
  if (error) return fail("We could not load announcements.", 500);
  const items: AnnouncementItem[] = (data ?? []).map((a) => ({ id: a.id, kind: a.kind, title: a.title, body: a.body, eventAt: a.event_at, createdAt: a.created_at, mine: a.author_id === user.id }));
  return NextResponse.json({ announcements: items });
}

/** Post one. Only the placement cell can; the database checks it. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = announcementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check what you entered.", 400);

  const { data: me } = await supabase.from("users").select("college_id").eq("id", user.id).single();
  if (!me) return fail("Finish signing up first.", 403);

  const { error } = await supabase.from("announcements").insert({
    college_id: me.college_id,
    author_id: user.id,
    kind: parsed.data.kind,
    title: parsed.data.title,
    body: parsed.data.body,
    event_at: parsed.data.eventAt ?? null,
  });
  if (error) {
    if (/placement cell/.test(error.message) || error.code === "42501") return fail("Only the placement cell can post announcements.", 403);
    if (/too many/.test(error.message)) return fail("That is plenty for today.", 429);
    return fail("We could not post that. Please try again.", 400);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Take down one of your own. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Choose an announcement.", 400);
  const { error } = await supabase.from("announcements").delete().eq("id", id).eq("author_id", user.id);
  return error ? fail("We could not remove that.", 400) : NextResponse.json({ ok: true });
}
