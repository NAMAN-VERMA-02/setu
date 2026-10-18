import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MAX_IMPORT_ROWS } from "@/lib/college/csv";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        fullName: z.string().trim().min(2).max(120),
        batch: z.number().int().min(1980).max(2100),
        branch: z.string().trim().min(1).max(60),
        email: z.email().max(200).nullable(),
      }),
    )
    .min(1, "There is nobody to import.")
    .max(MAX_IMPORT_ROWS),
});

/** The imported list, each person marked as joined or not. Placement cell only. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { data, error } = await supabase.rpc("alumni_import_status");
  if (error) return fail("This page is for your college's placement cell.", 403);
  return NextResponse.json({
    people: (data ?? []).map((r: { id: string; full_name: string; batch: number; branch: string; email: string | null; joined: boolean }) => ({
      id: r.id,
      fullName: r.full_name,
      batch: r.batch,
      branch: r.branch,
      email: r.email,
      joined: r.joined,
    })),
  });
}

/** Add people to the list. People already on it (same email) are skipped. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the list and try again.", 400);

  const { data: me } = await supabase.from("users").select("college_id, role").eq("id", user.id).single();
  if (!me || me.role !== "placement") return fail("Only the placement cell can import alumni.", 403);

  const { data: existing } = await supabase.from("alumni_imports").select("email").not("email", "is", null);
  const have = new Set((existing ?? []).map((e) => String(e.email).toLowerCase()));
  const fresh = parsed.data.rows.filter((r) => !r.email || !have.has(r.email.toLowerCase()));

  if (fresh.length > 0) {
    const { error } = await supabase
      .from("alumni_imports")
      .insert(fresh.map((r) => ({ college_id: me.college_id, uploaded_by: user.id, full_name: r.fullName, batch: r.batch, branch: r.branch, email: r.email })));
    if (error) return fail("We could not save that list. Please try again.", 400);
  }
  return NextResponse.json({ added: fresh.length, skipped: parsed.data.rows.length - fresh.length }, { status: 201 });
}
