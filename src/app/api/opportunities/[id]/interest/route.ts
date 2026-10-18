import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { interestSchema } from "@/lib/validation/opportunities";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** "I'm interested": one short note to the poster. Withdraw by sending DELETE. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/opportunities/[id]/interest">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // the note is optional
  }
  const parsed = interestSchema.safeParse(body);
  if (!parsed.success) return fail("Keep the note under 500 characters.", 400);

  const { error } = await supabase
    .from("opportunity_interests")
    .insert({ opportunity_id: id, user_id: user.id, note: parsed.data.note || null });
  if (error) {
    if (error.code === "23505") return fail("You have already shown interest.", 409);
    if (/closed/.test(error.message)) return fail("This opportunity is closed.", 410);
    if (/own opportunity/.test(error.message)) return fail("You posted this one.", 409);
    return fail("We could not send that. Please try again.", 400);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/opportunities/[id]/interest">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { error } = await supabase.from("opportunity_interests").delete().eq("opportunity_id", id).eq("user_id", user.id);
  return error ? fail("We could not withdraw that.", 400) : NextResponse.json({ ok: true });
}
