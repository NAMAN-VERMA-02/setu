"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, roleExtras, type ProfileActionState } from "@/lib/validation/profile";

export async function saveProfile(input: unknown): Promise<ProfileActionState> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { errors: parsed.error.issues.map((i) => i.message) };
  const p = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!me) return { message: "Finish signing up first." };

  // Only keep the extras that belong to this role.
  const extras = roleExtras(me.role);
  const details: Record<string, string> = {};
  if (extras.includes("stage") && p.stage) details.stage = p.stage;
  if (extras.includes("problems") && p.problems) details.problems = p.problems;
  if (extras.includes("lab") && p.lab) details.lab = p.lab;
  if (extras.includes("hiringFocus") && p.hiringFocus) details.hiring_focus = p.hiringFocus;
  const hasCompany = extras.includes("company");

  const { error } = await supabase
    .from("users")
    .update({
      headline: p.headline || null,
      bio: p.bio || null,
      location: p.location || null,
      current_company: hasCompany ? p.currentCompany || null : null,
      current_title: hasCompany ? p.currentTitle || null : null,
      expertise: p.expertise,
      open_to: p.openTo,
      details,
    })
    .eq("id", user.id);
  if (error) return { message: "We could not save your profile. Please try again." };

  // Replace the person's intents with the submitted set.
  const { error: clearError } = await supabase.from("intents").delete().eq("user_id", user.id);
  if (clearError) return { message: "We could not save your profile. Please try again." };
  if (p.intents.length > 0) {
    const { error: insertError } = await supabase.from("intents").insert(p.intents.map((i) => ({ ...i, user_id: user.id })));
    if (insertError) return { message: "We could not save your intents. Please try again." };
  }

  return { ok: true, message: "Profile saved." };
}
