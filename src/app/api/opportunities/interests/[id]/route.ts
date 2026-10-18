import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { interestStatusSchema } from "@/lib/validation/opportunities";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** The poster marks an applicant as seen or shortlisted. Row security limits this to the poster. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/opportunities/interests/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = interestStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Choose seen or shortlisted.", 400);

  const { data, error } = await supabase
    .from("opportunity_interests")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return fail("We could not update that.", 400);
  return data ? NextResponse.json({ ok: true }) : fail("Not found.", 404);
}
