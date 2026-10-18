import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { respondSchema } from "@/lib/validation/connections";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Accept, or quietly decline, a request addressed to you. A decline is never shown to the requester. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/connections/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = respondSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Choose accept or decline.", 400);

  if (parsed.data.action === "accept") {
    const { data, error } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .eq("id", id)
      .eq("addressee_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) return fail("We could not accept that.", 400);
    return data ? NextResponse.json({ ok: true }) : fail("Request not found.", 404);
  }

  const { error } = await supabase
    .from("connection_declines")
    .upsert({ connection_id: id, declined_by: user.id }, { onConflict: "connection_id", ignoreDuplicates: true });
  return error ? fail("We could not do that.", 400) : NextResponse.json({ ok: true });
}

/** Remove a connection, or withdraw a request you sent. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/connections/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { error } = await supabase.from("connections").delete().eq("id", id);
  return error ? fail("We could not remove that.", 400) : NextResponse.json({ ok: true });
}
