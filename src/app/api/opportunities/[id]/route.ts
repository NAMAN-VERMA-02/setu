import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { closeSchema } from "@/lib/validation/opportunities";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Close one of your own opportunities. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/opportunities/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = closeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Only closing is supported.", 400);

  const { data, error } = await supabase
    .from("opportunities")
    .update({ status: "closed" })
    .eq("id", id)
    .eq("poster_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return fail("We could not close that.", 400);
  return data ? NextResponse.json({ ok: true }) : fail("Opportunity not found.", 404);
}
