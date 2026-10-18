import { NextResponse } from "next/server";
import { safeLink, type NotificationItem } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** My latest notifications, whether the weekly email is on, and how many are unread. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const [{ data, error }, { data: me }] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, link, created_at, read_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("users").select("email_digest").eq("id", user.id).single(),
  ]);
  if (error) return fail("We could not load your updates.", 500);

  const items: NotificationItem[] = (data ?? []).map((n) => ({ id: n.id, kind: n.kind, title: n.title, link: safeLink(n.link), createdAt: n.created_at, read: n.read_at !== null }));
  return NextResponse.json({ notifications: items, unread: items.filter((i) => !i.read).length, emailDigest: me?.email_digest ?? true });
}
