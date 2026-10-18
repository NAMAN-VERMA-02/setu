"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { journeySchema, type JourneyActionState } from "@/lib/validation/journey";

export async function saveJourney(input: unknown): Promise<JourneyActionState> {
  const parsed = journeySchema.safeParse(input);
  if (!parsed.success) {
    return { errors: parsed.error.issues.map((i) => i.message) };
  }
  const j = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rows = j.snapshots.map((s) => ({
    user_id: user.id,
    semester: s.semester,
    cgpa_range: s.cgpaRange,
    backlog_count: s.backlogCount,
    tenth_range: j.tenthRange,
    twelfth_range: j.twelfthRange,
    skills: s.skills,
    status: s.status || null,
    decision: s.decision,
    show_cgpa: s.showCgpa,
    show_tenth: j.showTenth,
    show_twelfth: j.showTwelfth,
  }));

  const { error: upsertError } = await supabase
    .from("snapshots")
    .upsert(rows, { onConflict: "user_id,semester" });
  if (upsertError) return { message: "We could not save your journey. Please try again." };

  // Drop semesters the user removed.
  const keep = j.snapshots.map((s) => s.semester);
  const { error: pruneError } = await supabase
    .from("snapshots")
    .delete()
    .eq("user_id", user.id)
    .not("semester", "in", `(${keep.join(",")})`);
  if (pruneError) return { message: "We could not save your journey. Please try again." };

  // One current goal per user.
  await supabase.from("goals").delete().eq("user_id", user.id);
  const { error: goalError } = await supabase.from("goals").insert({
    user_id: user.id,
    target: j.goalTarget,
    company: j.goalCompany || null,
    open_question: j.goalQuestion || null,
  });
  if (goalError) return { message: "We could not save your goal. Please try again." };

  return { ok: true, message: "Journey saved." };
}
