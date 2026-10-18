import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { vouchError, vouchSchema } from "@/lib/validation/vouches";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Vouches for one student, newest first. Same college only; row security does the scoping. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const studentId = request.nextUrl.searchParams.get("studentId") ?? "";
  if (!vouchSchema.shape.studentId.safeParse(studentId).success) return fail("Choose a student.", 400);

  const { data, error } = await supabase
    .from("vouches")
    .select("id, voucher_id, skill, note, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return fail("We could not load vouches.", 500);

  const ids = [...new Set((data ?? []).map((v) => v.voucher_id as string))];
  const { data: people } = ids.length ? await supabase.from("users").select("id, full_name, role, current_company").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p]));

  return NextResponse.json({
    vouches: (data ?? []).map((v) => ({
      id: v.id,
      skill: v.skill,
      note: v.note,
      createdAt: v.created_at,
      mine: v.voucher_id === user.id,
      voucher: who.get(v.voucher_id) ? { id: v.voucher_id, name: who.get(v.voucher_id)!.full_name, role: who.get(v.voucher_id)!.role, company: who.get(v.voucher_id)!.current_company } : null,
    })),
  });
}

/** Vouch for a skill. The database decides whether you are allowed to. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = vouchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check what you entered.", 400);
  const { studentId, skill, note } = parsed.data;

  const { error } = await supabase.from("vouches").insert({ voucher_id: user.id, student_id: studentId, skill, note: note || null });
  if (error) {
    const e = vouchError(error.message);
    return fail(e.error, e.status);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Take back your own vouch. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!vouchSchema.shape.studentId.safeParse(id).success) return fail("Choose a vouch.", 400);
  const { error } = await supabase.from("vouches").delete().eq("id", id).eq("voucher_id", user.id);
  return error ? fail("We could not remove that.", 400) : NextResponse.json({ ok: true });
}
