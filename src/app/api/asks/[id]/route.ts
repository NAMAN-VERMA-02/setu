import { NextResponse, type NextRequest } from "next/server";
import { mapDbError } from "@/lib/asks/errors";
import { forwardUrl, generateToken, hashToken } from "@/lib/asks/token";
import { canAdvance, nextStep, type TrustStep } from "@/lib/asks/trust";
import { createClient } from "@/lib/supabase/server";
import { patchAskSchema } from "@/lib/validation/asks";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Act on a request: advance trust, record work, forward, accept, silently decline, or cancel. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/asks/[id]">) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Send a JSON body.", 400);
  }
  const parsed = patchAskSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your request.", 400);
  const input = parsed.data;

  // RLS only returns requests I am a party to.
  const { data: ask } = await supabase.from("asks").select("*").eq("id", id).maybeSingle();
  if (!ask) return fail("Request not found.", 404);

  const isAsker = ask.asker_id === user.id;
  const isSenior = ask.target_id === user.id || ask.via_id === user.id;

  const update = async (patch: Record<string, unknown>) => {
    const { data, error } = await supabase.from("asks").update(patch).eq("id", id).select("id").maybeSingle();
    if (error) {
      const mapped = mapDbError(error.message);
      return fail(mapped.error, mapped.status);
    }
    if (!data) return fail("That change was not allowed.", 403);
    return null;
  };

  switch (input.action) {
    case "cancel": {
      if (!isAsker) return fail("Only the student can cancel.", 403);
      return (await update({ status: "cancelled" })) ?? NextResponse.json({ ok: true });
    }

    case "submit_work": {
      if (!isAsker) return fail("Only the student can share work.", 403);
      return (await update({ work_url: input.workUrl })) ?? NextResponse.json({ ok: true });
    }

    case "accept": {
      if (!isSenior) return fail("Only the senior can do that.", 403);
      return (await update({ status: "accepted" })) ?? NextResponse.json({ ok: true });
    }

    case "decline": {
      if (!isSenior) return fail("Only the senior can do that.", 403);
      // Recorded where the student can never read it; the request just keeps waiting for them.
      const { error } = await supabase.from("ask_declines").upsert({ ask_id: id, declined_by: user.id }, { onConflict: "ask_id", ignoreDuplicates: true });
      if (error) return fail("We could not do that. Please try again.", 400);
      return NextResponse.json({ ok: true });
    }

    case "advance": {
      if (!isSenior) return fail("Only the senior can do that.", 403);
      const step = ask.trust_step as TrustStep;
      const next = nextStep(step);
      if (!next) return fail("There is no step after a referral.", 409);
      if (!canAdvance(step, Boolean(ask.work_seen_at))) {
        return fail("A referral unlocks only after you have seen the student's work.", 409);
      }
      return (await update({ trust_step: next })) ?? NextResponse.json({ ok: true, trustStep: next });
    }

    case "mark_work_seen": {
      if (!isSenior) return fail("Only the senior can do that.", 403);
      if (!ask.work_url) return fail("The student has not shared any work yet.", 409);
      return (await update({ work_seen_at: new Date().toISOString() })) ?? NextResponse.json({ ok: true });
    }

    case "forward": {
      if (ask.via_id !== user.id) return fail("Only the bridging senior can forward this request.", 403);
      if (ask.forward_token_hash) return fail("A forward link already exists for this request.", 409);

      const token = generateToken();
      const failure = await update({
        forward_token_hash: hashToken(token),
        status: "forwarded",
        forwarded_at: new Date().toISOString(),
      });
      if (failure) return failure;

      // The link is shown once. Only its hash is stored, so it cannot be recovered later.
      const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
      return NextResponse.json({ link: forwardUrl(site, token), expiresAt: ask.expires_at });
    }
  }
}
