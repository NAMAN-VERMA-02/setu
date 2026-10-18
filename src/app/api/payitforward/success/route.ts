import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { successSchema } from "@/lib/validation/payforward";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** "I got it": records the success once and opens three answers to give back. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // company is optional
  }
  const parsed = successSchema.safeParse(body);
  if (!parsed.success) return fail("Keep the company name under 120 characters.", 400);

  const { error } = await supabase.rpc("report_success", { p_company: parsed.data.company ?? "" });
  if (error) {
    return /already reported/.test(error.message)
      ? fail("You have already shared your success.", 409)
      : fail("We could not save that. Please try again.", 400);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
