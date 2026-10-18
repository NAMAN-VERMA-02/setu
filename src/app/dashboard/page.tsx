import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardView, type DashboardData } from "@/components/dashboard/dashboard-view";
import { isExpired } from "@/lib/asks/trust";
import { profileCompleteness } from "@/lib/profile/completeness";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

async function Home() {
  await connection(); // uses the current time below, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { count: semesters },
    { data: asks },
    { data: declines },
    { count: answersReceived },
    { data: conns },
    { data: connDeclines },
    { count: myPosts },
    { data: interests },
    { count: openOpps },
    { count: people },
    { count: intentCount },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("full_name, role, branch, batch, college_email_verified, succeeded_at, help_owed, headline, bio, location, current_company, current_title, expertise, open_to, details")
      .eq("id", user.id)
      .single(),
    supabase.from("snapshots").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("asks").select("asker_id, status, trust_step, expires_at, id").limit(200),
    supabase.from("ask_declines").select("ask_id").eq("declined_by", user.id),
    supabase.from("helps").select("id", { count: "exact", head: true }).eq("helped_id", user.id),
    supabase.from("connections").select("id, requester_id, status").limit(500),
    supabase.from("connection_declines").select("connection_id").eq("declined_by", user.id),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("poster_id", user.id).eq("status", "open"),
    supabase.from("opportunity_interests").select("user_id, status").eq("status", "sent"),
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "open").neq("poster_id", user.id),
    supabase.from("users").select("id", { count: "exact", head: true }).neq("id", user.id),
    supabase.from("intents").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("active", true),
  ]);
  if (!profile) redirect("/login?error=profile");

  const declined = new Set((declines ?? []).map((d) => d.ask_id as string));
  const sent = (asks ?? []).filter((a) => a.asker_id === user.id);
  const received = (asks ?? []).filter((a) => a.asker_id !== user.id && !declined.has(a.id));

  const connDeclined = new Set((connDeclines ?? []).map((d) => d.connection_id as string));
  const liveConns = (conns ?? []).filter((c) => !connDeclined.has(c.id));

  const completeness = profileCompleteness({
    role: profile.role,
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    current_company: profile.current_company,
    current_title: profile.current_title,
    expertise: profile.expertise,
    open_to: profile.open_to,
    details: profile.details,
    intents: intentCount ?? 0,
  });

  const data: DashboardData = {
    fullName: profile.full_name,
    role: profile.role,
    branch: profile.branch,
    batch: profile.batch,
    verified: profile.college_email_verified,
    answersReceived: answersReceived ?? 0,
    state: {
      role: profile.role,
      semesters: semesters ?? 0,
      sent: sent.length,
      climbed: sent.some((a) => a.trust_step !== "question"),
      waitingOnMe: received.filter((a) => a.status === "pending" && !isExpired(a.expires_at)).length,
      succeeded: Boolean(profile.succeeded_at),
      helpOwed: profile.help_owed,
      incomingConnections: liveConns.filter((c) => c.status === "pending" && c.requester_id !== user.id).length,
      connections: liveConns.filter((c) => c.status === "accepted").length,
      myPosts: myPosts ?? 0,
      // Interest sent to my posts (the policy only returns rows on my posts or sent by me).
      interestsOnMine: (interests ?? []).filter((i) => i.user_id !== user.id).length,
      profilePercent: completeness.percent,
      openOpps: openOpps ?? 0,
      people: people ?? 0,
    },
  };

  return <DashboardView data={data} />;
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}
