import { NextResponse } from "next/server";
import { rankOpportunities } from "@/lib/opportunities/rank";
import { createClient } from "@/lib/supabase/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** My own posts, with the people who showed interest and how well each one fits. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { data: posts, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("poster_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return fail("We could not load your posts.", 500);

  const ids = (posts ?? []).map((p) => p.id as string);
  const { data: interests } = ids.length
    ? await supabase.from("opportunity_interests").select("id, opportunity_id, user_id, note, status, created_at").in("opportunity_id", ids)
    : { data: [] as { id: string; opportunity_id: string; user_id: string; note: string | null; status: string; created_at: string }[] };

  const peopleIds = [...new Set((interests ?? []).map((i) => i.user_id))];
  const [{ data: people }, { data: expertise }, { data: snaps }] = await Promise.all([
    peopleIds.length ? supabase.from("users").select("id, full_name, role, batch, branch, headline").in("id", peopleIds) : Promise.resolve({ data: [] as { id: string; full_name: string; role: string; batch: number; branch: string; headline: string | null }[] }),
    peopleIds.length ? supabase.from("users").select("id, expertise").in("id", peopleIds) : Promise.resolve({ data: [] as { id: string; expertise: string[] }[] }),
    Promise.resolve({ data: null }),
  ]);
  void snaps;
  const personOf = new Map((people ?? []).map((p) => [p.id, p]));
  const skillsOf = new Map((expertise ?? []).map((e) => [e.id, e.expertise ?? []]));

  const result = (posts ?? []).map((p) => {
    const applicants = (interests ?? [])
      .filter((i) => i.opportunity_id === p.id)
      .map((i) => {
        const person = personOf.get(i.user_id);
        // How well the applicant's stated skills fit this post, using the same ranking rules.
        const [fit] = rankOpportunities(
          { skills: skillsOf.get(i.user_id) ?? [], goalText: "", goalCompany: "", seekIntents: [] },
          [{ id: p.id, kind: p.kind, title: p.title, description: p.description, company: p.company, skills: p.skills ?? [], createdAt: p.created_at, deadline: null }],
        );
        return {
          id: i.id,
          note: i.note,
          status: i.status,
          createdAt: i.created_at,
          person: person ? { id: person.id, name: person.full_name, role: person.role, batch: person.batch, branch: person.branch, headline: person.headline } : null,
          reasons: fit?.reasons.filter((r) => r.startsWith("Uses your skills")).map((r) => r.replace("your", "the post's")) ?? [],
        };
      });
    return {
      id: p.id as string,
      kind: p.kind as string,
      title: p.title as string,
      status: p.status as string,
      createdAt: p.created_at as string,
      applicants,
    };
  });

  return NextResponse.json({ opportunities: result });
}
