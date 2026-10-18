import type { SupabaseClient } from "@supabase/supabase-js";
import type { Seeker } from "./rank";

/** Builds the profile used to rank things for one person, from data they can already see. */
export async function loadSeeker(supabase: SupabaseClient, userId: string): Promise<{ seeker: Seeker; role: string } | null> {
  const [{ data: me }, { data: goal }, { data: snaps }, { data: intents }] = await Promise.all([
    supabase.from("users").select("role, expertise").eq("id", userId).single(),
    supabase.from("goals").select("target, company").eq("user_id", userId).maybeSingle(),
    supabase.from("snapshots").select("skills").eq("user_id", userId),
    supabase.from("intents").select("statement").eq("user_id", userId).eq("kind", "seek").eq("active", true),
  ]);
  if (!me) return null;

  const skills = new Set<string>((me.expertise as string[] | null) ?? []);
  for (const s of snaps ?? []) for (const k of (s.skills as string[] | null) ?? []) skills.add(k);

  return {
    role: me.role as string,
    seeker: {
      skills: [...skills],
      goalText: (goal?.target as string | undefined) ?? "",
      goalCompany: (goal?.company as string | undefined) ?? "",
      seekIntents: (intents ?? []).map((i) => i.statement as string),
    },
  };
}
