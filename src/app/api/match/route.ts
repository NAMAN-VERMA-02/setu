import { NextResponse, type NextRequest } from "next/server";
import { computeMatches } from "@/lib/match/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Past-self matches: seniors from the same college who were in the same semester. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const admin = createAdminClient();
  if (!admin) return fail("Matching is not configured yet.", 503);

  const requested = Number(request.nextUrl.searchParams.get("semester"));
  const result = await computeMatches(supabase, admin, user.id, requested || undefined);
  return result.ok ? NextResponse.json(result.body) : fail(result.error, result.status);
}
