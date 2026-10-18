import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Unread count for the header. Quietly 0 when signed out. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });
  const { data } = await supabase.rpc("notifications_unread");
  return NextResponse.json({ count: typeof data === "number" ? data : 0 });
}
