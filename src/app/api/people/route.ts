import { NextResponse, type NextRequest } from "next/server";
import type { ConnState } from "@/lib/connections/types";
import { loadSeeker } from "@/lib/opportunities/seeker";
import { rankPeople, type PersonRow } from "@/lib/people/rank";
import { chunks } from "@/lib/scoring/rows";
import { createClient } from "@/lib/supabase/server";
import { OPEN_TO } from "@/lib/validation/profile";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const ROLES = ["student", "alumni", "faculty", "founder", "recruiter", "placement"];
const MAX_RESULTS = 40;

/** Find people by expertise and intent. Same college only; row security does the scoping. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const loaded = await loadSeeker(supabase, user.id);
  if (!loaded) return fail("Finish signing up first.", 403);

  const sp = request.nextUrl.searchParams;
  const text = (sp.get("q") ?? "").slice(0, 200);
  const role = sp.get("role") ?? undefined;
  const openTo = sp.get("openTo") ?? undefined;
  const company = (sp.get("company") ?? "").slice(0, 100) || undefined;
  if (role && !ROLES.includes(role)) return fail("Unknown role.", 400);
  if (openTo && !(OPEN_TO as readonly string[]).includes(openTo)) return fail("Unknown option.", 400);

  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, role, batch, branch, headline, bio, current_company, current_title, location, expertise, open_to, last_active_at, help_owed")
    .neq("id", user.id)
    .limit(500);
  if (error) return fail("We could not search right now.", 500);

  const ids = (users ?? []).map((u) => u.id as string);
  const intentsOf = new Map<string, PersonRow["intents"]>();
  for (const part of chunks(ids, 150)) {
    const { data } = await supabase.from("intents").select("user_id, kind, category, statement").in("user_id", part).eq("active", true);
    for (const i of data ?? []) {
      const list = intentsOf.get(i.user_id) ?? [];
      list.push({ kind: i.kind, category: i.category, statement: i.statement });
      intentsOf.set(i.user_id, list);
    }
  }

  // My connection state with each person, from rows I am allowed to see.
  const { data: conns } = await supabase.from("connections").select("requester_id, addressee_id, status");
  const stateOf = new Map<string, ConnState>();
  for (const c of conns ?? []) {
    const mine = c.requester_id === user.id;
    stateOf.set(mine ? c.addressee_id : c.requester_id, c.status === "accepted" ? "connected" : mine ? "pending_out" : "pending_in");
  }

  const vouchCount = new Map<string, number>();
  for (const part of chunks(ids, 150)) {
    const { data } = await supabase.from("vouches").select("student_id").in("student_id", part);
    for (const v of data ?? []) vouchCount.set(v.student_id, (vouchCount.get(v.student_id) ?? 0) + 1);
  }

  const rows: PersonRow[] = (users ?? []).map((u) => ({
    vouches: vouchCount.get(u.id) ?? 0,
    id: u.id,
    fullName: u.full_name,
    role: u.role,
    batch: u.batch,
    branch: u.branch,
    headline: u.headline,
    bio: u.bio,
    company: u.current_company,
    title: u.current_title,
    location: u.location,
    expertise: u.expertise ?? [],
    openTo: u.open_to ?? [],
    intents: intentsOf.get(u.id) ?? [],
    lastActiveAt: u.last_active_at,
    helpOwed: u.help_owed,
  }));

  const ranked = rankPeople({ text, role, openTo, company }, loaded.seeker, rows).slice(0, MAX_RESULTS);

  return NextResponse.json({
    total: ranked.length,
    people: ranked.map((p) => ({
      id: p.id,
      name: p.fullName,
      role: p.role,
      batch: p.batch,
      branch: p.branch,
      headline: p.headline,
      company: p.company,
      title: p.title,
      expertise: p.expertise.slice(0, 6),
      openTo: p.openTo,
      intents: p.intents.slice(0, 3),
      reasons: p.reasons,
      vouches: p.vouches ?? 0,
      connection: stateOf.get(p.id) ?? "none",
    })),
  });
}
