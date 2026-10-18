import { fedDb } from "@/lib/fed/db";
import { fail, isStage, ok } from "@/lib/fed/server";

/** "3 weeks later: hired." Presenter only. Everyone who said yes earns +100. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isStage(req)) return fail("Presenter only.", 403);
  const { id } = await ctx.params;
  const { data, error } = await fedDb().rpc("fed_mark_hired", { p_intro: id });
  if (error) return fail(error.message.includes("not_delivered") ? "This intro has not been delivered yet." : "We could not mark that hire.", 409);
  return ok({ ok: true, helpers: (data as string[]).length });
}
