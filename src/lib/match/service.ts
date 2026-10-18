import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRouteMap,
  chunks,
  matchSeniors,
  toTraits,
  type Candidate,
  type Outcome,
  type SnapshotRow,
} from "@/lib/scoring";
import type { MatchResponse } from "@/lib/scoring/response";

const MAX_RESULTS = 30;
const MAX_SENIORS = 2000;
const CHUNK = 150; // keeps `in (...)` URLs short

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export type MatchOutcome =
  | { ok: true; body: MatchResponse; goal: { target: string | null; company: string } }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): MatchOutcome => ({ ok: false, status, error });

/**
 * Past-self matches for one student: seniors from the same college who were in the same
 * semester. `supabase` acts as the student (RLS applies); `admin` reads other people's rows
 * and only sanitised results leave this function.
 */
export async function computeMatches(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  requestedSemester?: number,
): Promise<MatchOutcome> {
  const { data: profile } = await supabase
    .from("users")
    .select("id, batch, branch, college_id")
    .eq("id", userId)
    .single();
  if (!profile) return fail(403, "Finish signing up first.");

  const { data: college } = await supabase.from("colleges").select("tier").eq("id", profile.college_id).single();
  if (!college) return fail(404, "College not found.");

  // Semester: the requested one, otherwise the latest the student has filled in.
  const { data: mine } = await supabase
    .from("snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("semester", { ascending: false });
  if (!mine?.length) return fail(409, "Share your journey first.");

  const semester =
    requestedSemester && Number.isInteger(requestedSemester) && requestedSemester > 0
      ? requestedSemester
      : mine[0].semester;
  const myRow = mine.find((s) => s.semester === semester);
  if (!myRow) return fail(409, "Add that semester to your journey first.");
  const me = toTraits(myRow, profile.branch, college.tier);

  const [{ data: goal }, { data: openBridge }] = await Promise.all([
    supabase.from("goals").select("target, company").eq("user_id", userId).maybeSingle(),
    supabase
      .from("asks")
      .select("id")
      .eq("asker_id", userId)
      .not("via_id", "is", null)
      .in("status", ["pending", "forwarded"])
      .gt("expires_at", new Date().toISOString())
      .limit(1),
  ]);
  const goalCompany: string = goal?.company?.trim() ?? "";
  const bridgeBlocked = (openBridge?.length ?? 0) > 0;
  const goalOut = { target: (goal?.target as string | null) ?? null, company: goalCompany };

  // Seniors: same college, earlier batch.
  const { data: seniors } = await admin
    .from("users")
    .select("id, full_name, branch, batch, last_active_at, help_owed")
    .eq("college_id", profile.college_id)
    .lt("batch", profile.batch)
    .neq("id", userId)
    .limit(MAX_SENIORS);
  if (!seniors?.length) {
    return { ok: true, goal: goalOut, body: { semester, total: 0, bridgeBlocked, routeMap: buildRouteMap([]), matches: [] } };
  }

  const ids = seniors.map((s) => s.id as string);
  const snapshots: SnapshotRow[] = [];
  const contacts = new Map<string, { company: string; count: number }>();
  const pending = new Map<string, number>();

  for (const part of chunks(ids, CHUNK)) {
    const [snaps, counts, waiting] = await Promise.all([
      admin.from("snapshots").select("*").in("user_id", part).eq("semester", semester),
      goalCompany
        ? admin.from("company_counts").select("user_id, company, count").in("user_id", part).ilike("company", escapeLike(goalCompany))
        : Promise.resolve({ data: [] as { user_id: string; company: string; count: number }[] }),
      // Waiting requests per senior, leaving out silently declined ones.
      admin.rpc("waiting_asks_for", { p_ids: part }),
    ]);
    snapshots.push(...((snaps.data ?? []) as SnapshotRow[]));
    for (const c of counts.data ?? []) contacts.set(c.user_id, { company: c.company, count: c.count });
    for (const w of (waiting.data ?? []) as { user_id: string; waiting: number }[]) pending.set(w.user_id, w.waiting);
  }

  const byId = new Map(seniors.map((s) => [s.id as string, s]));
  const candidates: Candidate[] = snapshots.flatMap((snap) => {
    const s = byId.get(snap.user_id);
    if (!s) return [];
    return [
      {
        id: s.id,
        displayName: s.full_name,
        batch: s.batch,
        branch: s.branch,
        traits: toTraits(snap, s.branch, college.tier),
        visibility: { cgpa: snap.show_cgpa, tenth: snap.show_tenth, twelfth: snap.show_twelfth },
        lastActiveAt: s.last_active_at,
        helpOwed: s.help_owed,
        contacts: contacts.get(s.id) ?? null,
        pendingAsks: pending.get(s.id) ?? 0,
      },
    ];
  });

  const all = matchSeniors(me, candidates, { semester });

  // What the matched seniors did next, as counts only.
  const matchedIds = all.map((m) => m.id);
  const lastDecision = new Map<string, { semester: number; decision: string }>();
  const goalCompanyOf = new Map<string, string>();
  for (const part of chunks(matchedIds, CHUNK)) {
    const [snaps, goals] = await Promise.all([
      admin.from("snapshots").select("user_id, semester, decision").in("user_id", part).not("decision", "is", null),
      admin.from("goals").select("user_id, company").in("user_id", part),
    ]);
    for (const r of snaps.data ?? []) {
      const prev = lastDecision.get(r.user_id);
      if (!prev || r.semester > prev.semester) lastDecision.set(r.user_id, { semester: r.semester, decision: r.decision });
    }
    for (const g of goals.data ?? []) if (g.company) goalCompanyOf.set(g.user_id, g.company);
  }
  const outcomes: Outcome[] = matchedIds.map((id) => ({
    decision: lastDecision.get(id)?.decision ?? null,
    company: goalCompanyOf.get(id) ?? null,
  }));
  const routeMap = buildRouteMap(outcomes);

  // A student with an open bridge request cannot start another one.
  const matches = (
    bridgeBlocked
      ? all.map((m) => {
          const routes = m.routes.filter((r) => r.type === "direct");
          return { ...m, routes, rank: Math.max(...routes.map((r) => r.rank)) };
        })
      : all
  ).slice(0, MAX_RESULTS);

  return { ok: true, goal: goalOut, body: { semester, total: all.length, bridgeBlocked, routeMap, matches } };
}
