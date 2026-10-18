import { NextResponse, type NextRequest } from "next/server";
import { rankOpportunities, tokens } from "@/lib/opportunities/rank";
import { loadSeeker } from "@/lib/opportunities/seeker";
import { createClient } from "@/lib/supabase/server";
import { OPP_KINDS, canPost, createOpportunitySchema } from "@/lib/validation/opportunities";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** The board, ranked for the signed-in person, with the reasons each one fits. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const loaded = await loadSeeker(supabase, user.id);
  if (!loaded) return fail("Finish signing up first.", 403);

  const kind = request.nextUrl.searchParams.get("kind");
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);

  let query = supabase.from("opportunities").select("*").eq("status", "open").neq("poster_id", user.id).order("created_at", { ascending: false }).limit(200);
  if (kind && (OPP_KINDS as readonly string[]).includes(kind)) query = query.eq("kind", kind);
  const { data: rows, error } = await query;
  if (error) return fail("We could not load opportunities.", 500);

  const posterIds = [...new Set((rows ?? []).map((r) => r.poster_id as string))];
  const [{ data: posters }, { data: mine }] = await Promise.all([
    posterIds.length
      ? supabase.from("users").select("id, full_name, role, headline, current_company").in("id", posterIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; role: string; headline: string | null; current_company: string | null }[] }),
    supabase.from("opportunity_interests").select("opportunity_id, status").eq("user_id", user.id),
  ]);
  const posterOf = new Map((posters ?? []).map((p) => [p.id, p]));
  const interestOf = new Map((mine ?? []).map((m) => [m.opportunity_id as string, m.status as string]));

  let items = (rows ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    title: r.title as string,
    description: r.description as string,
    company: (r.company as string | null) ?? null,
    skills: (r.skills as string[]) ?? [],
    mode: (r.mode as string | null) ?? null,
    location: (r.location as string | null) ?? null,
    createdAt: r.created_at as string,
    deadline: (r.deadline as string | null) ?? null,
    poster: posterOf.has(r.poster_id)
      ? {
          id: r.poster_id as string,
          name: posterOf.get(r.poster_id)!.full_name,
          role: posterOf.get(r.poster_id)!.role,
          headline: posterOf.get(r.poster_id)!.headline,
        }
      : null,
    interest: interestOf.get(r.id as string) ?? null,
  }));

  if (q.trim()) {
    const want = tokens(q);
    items = items.filter((i) => {
      const hay = tokens(`${i.title} ${i.description} ${i.company ?? ""} ${i.skills.join(" ")}`);
      return want.every((w) => hay.some((h) => h.includes(w)));
    });
  }

  return NextResponse.json({ canPost: canPost(loaded.role), opportunities: rankOpportunities(loaded.seeker, items) });
}

/** Post an opportunity. The database checks the poster's role and the 20-open limit. */
export async function POST(request: NextRequest) {
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
  const parsed = createOpportunitySchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your post.", 400);
  const o = parsed.data;

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      poster_id: user.id,
      kind: o.kind,
      title: o.title,
      description: o.description,
      company: o.company || null,
      skills: o.skills,
      mode: o.mode ?? null,
      location: o.location || null,
      deadline: o.deadline ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (/cannot post/.test(error.message)) return fail("Your account type cannot post opportunities.", 403);
    if (/at most 20/.test(error.message)) return fail("You already have 20 open opportunities. Close one first.", 409);
    return fail("We could not publish that. Please try again.", 400);
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
