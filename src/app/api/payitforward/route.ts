import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { chunks, pickJuniors, toTraits, type JuniorInput, type SnapshotRow } from "@/lib/scoring";
import type { PayItForwardResponse } from "@/lib/validation/payforward";

const CHUNK = 150;
const MAX_JUNIORS = 1000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Where I stand: my three answers owed, the juniors to answer, and answers I have received. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const { data: me } = await supabase
    .from("users")
    .select("id, batch, college_id, succeeded_at, success_company, help_owed")
    .eq("id", user.id)
    .single();
  if (!me) return fail("Finish signing up first.", 403);

  const [{ count: answered }, { data: gotRows }] = await Promise.all([
    supabase.from("helps").select("id", { count: "exact", head: true }).eq("helper_id", user.id),
    supabase.from("helps").select("id, question, answer, helper_id, created_at").eq("helped_id", user.id).order("created_at", { ascending: false }),
  ]);

  const helperIds = [...new Set((gotRows ?? []).map((h) => h.helper_id as string))];
  const { data: helpers } = helperIds.length
    ? await supabase.from("users").select("id, batch, branch").in("id", helperIds)
    : { data: [] as { id: string; batch: number; branch: string }[] };
  const helperOf = new Map((helpers ?? []).map((h) => [h.id, h]));

  const received: PayItForwardResponse["received"] = (gotRows ?? []).map((h) => ({
    id: h.id,
    question: h.question,
    answer: h.answer,
    helper: { batch: helperOf.get(h.helper_id)?.batch ?? null, branch: helperOf.get(h.helper_id)?.branch ?? null },
    createdAt: h.created_at,
  }));

  const body: PayItForwardResponse = {
    succeeded: Boolean(me.succeeded_at),
    company: me.success_company,
    helpOwed: me.help_owed,
    answered: answered ?? 0,
    candidates: [],
    received,
  };

  if (!me.succeeded_at || me.help_owed <= 0) return NextResponse.json(body);

  const admin = createAdminClient();
  if (!admin) return fail("Pay it forward is not configured yet.", 503);

  const { data: college } = await supabase.from("colleges").select("tier").eq("id", me.college_id).single();
  if (!college) return fail("College not found.", 404);

  // My own yesterday, by semester.
  const { data: mine } = await supabase.from("snapshots").select("*").eq("user_id", user.id);
  const { data: myUser } = await supabase.from("users").select("branch").eq("id", user.id).single();
  const helperBySemester = Object.fromEntries(
    ((mine ?? []) as SnapshotRow[]).map((s) => [s.semester, toTraits(s, myUser?.branch ?? "", college.tier)]),
  );

  // Juniors from my college who have a question waiting and have not been answered by me.
  const { data: alreadyHelped } = await supabase.from("helps").select("helped_id").eq("helper_id", user.id);
  const skip = new Set((alreadyHelped ?? []).map((h) => h.helped_id as string));

  const { data: juniors } = await admin
    .from("users")
    .select("id, full_name, branch, batch")
    .eq("college_id", me.college_id)
    .gt("batch", me.batch)
    .limit(MAX_JUNIORS);
  const juniorRows = (juniors ?? []).filter((j) => !skip.has(j.id));
  const ids = juniorRows.map((j) => j.id as string);

  const goals = new Map<string, { target: string | null; question: string }>();
  const latest = new Map<string, SnapshotRow>();
  for (const part of chunks(ids, CHUNK)) {
    const [g, s] = await Promise.all([
      admin.from("goals").select("user_id, target, open_question").in("user_id", part).not("open_question", "is", null),
      admin.from("snapshots").select("*").in("user_id", part),
    ]);
    for (const row of g.data ?? []) goals.set(row.user_id, { target: row.target, question: row.open_question });
    for (const row of (s.data ?? []) as SnapshotRow[]) {
      const prev = latest.get(row.user_id);
      if (!prev || row.semester > prev.semester) latest.set(row.user_id, row);
    }
  }

  const inputs: JuniorInput[] = juniorRows.flatMap((j) => {
    const goal = goals.get(j.id);
    const snap = latest.get(j.id);
    if (!goal || !snap) return [];
    return [
      {
        id: j.id,
        displayName: j.full_name,
        batch: j.batch,
        branch: j.branch,
        goalTarget: goal.target,
        question: goal.question,
        semester: snap.semester,
        traits: toTraits(snap, j.branch, college.tier),
        visibility: { cgpa: snap.show_cgpa, tenth: snap.show_tenth, twelfth: snap.show_twelfth },
      },
    ];
  });

  // Never more than the answers still owed.
  body.candidates = pickJuniors(helperBySemester, inputs, Math.min(3, me.help_owed)).map((p) => ({
    id: p.id,
    displayName: p.displayName,
    batch: p.batch,
    branch: p.branch,
    goalTarget: p.goalTarget,
    question: p.question,
    semester: p.semester,
    firstLine: p.firstLine,
  }));

  return NextResponse.json(body);
}
