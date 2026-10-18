import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const createSchema = z.object({
  role: z.enum(["recruiter", "founder"]),
  note: z.string().trim().max(200).optional(),
});

/** Invites I created (the placement cell sees its whole college). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { data: rows, error } = await supabase
    .from("invites")
    .select("id, code, role, note, expires_at, used_by, used_at, created_at, invited_by")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("We could not load invites.", 500);

  const usedIds = (rows ?? []).map((r) => r.used_by).filter(Boolean) as string[];
  const { data: people } = usedIds.length
    ? await supabase.from("users").select("id, full_name").in("id", usedIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  return NextResponse.json({
    invites: (rows ?? []).map((r) => ({
      id: r.id,
      code: r.code,
      role: r.role,
      note: r.note,
      expiresAt: r.expires_at,
      usedAt: r.used_at,
      expired: !r.used_at && new Date(r.expires_at).getTime() < Date.now(),
      usedBy: r.used_by ? (nameOf.get(r.used_by) ?? "Someone") : null,
      mine: r.invited_by === user.id,
    })),
  });
}

/** Create a single-use, 14-day invite. The database checks who may invite and the 10-open limit. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Choose recruiter or founder.", 400);

  // college_id is overwritten by the database trigger with the inviter's own college.
  const { data: me } = await supabase.from("users").select("college_id").eq("id", user.id).single();
  if (!me) return fail("Finish signing up first.", 403);

  const { data, error } = await supabase
    .from("invites")
    .insert({ role: parsed.data.role, note: parsed.data.note || null, college_id: me.college_id, invited_by: user.id })
    .select("code")
    .single();
  if (error) {
    if (/cannot invite/.test(error.message)) return fail("Only alumni, faculty and the placement cell can invite people.", 403);
    if (/at most 10/.test(error.message)) return fail("You have 10 open invites. Wait for some to be used or expire.", 409);
    return fail("We could not create that invite.", 400);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return NextResponse.json({ code: data.code, link: `${site.replace(/\/+$/, "")}/signup?invite=${data.code}` }, { status: 201 });
}
