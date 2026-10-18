import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm, type InitialProfile } from "./profile-form";

export const metadata = { title: "Your profile" };

async function Profile() {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: me }, { data: intents }] = await Promise.all([
    supabase.from("users").select("role, headline, bio, location, current_company, current_title, expertise, open_to, details").eq("id", user.id).single(),
    supabase.from("intents").select("kind, category, statement").eq("user_id", user.id).eq("active", true).order("created_at"),
  ]);
  if (!me) redirect("/login?error=profile");

  const d = (me.details ?? {}) as Record<string, string>;
  const initial: InitialProfile = {
    role: me.role,
    headline: me.headline ?? "",
    bio: me.bio ?? "",
    location: me.location ?? "",
    currentCompany: me.current_company ?? "",
    currentTitle: me.current_title ?? "",
    expertise: (me.expertise ?? []).join(", "),
    openTo: me.open_to ?? [],
    intents: (intents ?? []) as InitialProfile["intents"],
    stage: d.stage ?? "",
    problems: d.problems ?? "",
    lab: d.lab ?? "",
    hiringFocus: d.hiring_focus ?? "",
  };
  return <ProfileForm initial={initial} />;
}

export default function ProfilePage() {
  return (
    <PageShell
      eyebrow="Be findable"
      title={["Your", "_profile_"]}
      lede="Tell people what you know, what you are looking for and what you can offer. This is how the right people find you."
    >
      <Suspense>
        <Profile />
      </Suspense>
    </PageShell>
  );
}
