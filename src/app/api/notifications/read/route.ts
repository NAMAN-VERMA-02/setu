import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ ids: z.array(z.uuid()).max(100).optional() });

/** Mark some, or all, of my notifications as read. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check what you sent." }, { status: 400 });

  const { data, error } = await supabase.rpc("mark_notifications_read", parsed.data.ids ? { p_ids: parsed.data.ids } : {});
  if (error) return NextResponse.json({ error: "We could not update that." }, { status: 400 });
  return NextResponse.json({ marked: data ?? 0 });
}
