import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** How many conversations have something unread. Quietly 0 when signed out. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });
  const { data } = await supabase.rpc("unread_threads");
  return NextResponse.json({ count: typeof data === "number" ? data : 0 });
}
