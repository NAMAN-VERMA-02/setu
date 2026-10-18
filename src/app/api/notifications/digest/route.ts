import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Turn my weekly email on or off. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const parsed = z.object({ on: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose on or off." }, { status: 400 });

  const { error } = await supabase.rpc("set_email_digest", { p_on: parsed.data.on });
  return error ? NextResponse.json({ error: "We could not save that." }, { status: 400 }) : NextResponse.json({ on: parsed.data.on });
}
