import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { MatchesView } from "./matches-view";

export const metadata = { title: "Your matches" };

async function Matches() {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: snaps } = await supabase
    .from("snapshots")
    .select("semester")
    .eq("user_id", user.id)
    .order("semester");
  if (!snaps?.length) redirect("/onboarding");

  const semesters = snaps.map((s) => s.semester as number);
  return <MatchesView semesters={semesters} initialSemester={semesters[semesters.length - 1]} />;
}

export default function MatchesPage() {
  return (
    <PageShell
      eyebrow="Past-self matches"
      title={["Where you are,", "_where they went_"]}
      lede="Seniors from your college who stood in your exact position, and the routes they took next."
    >
      <Suspense>
        <Matches />
      </Suspense>
    </PageShell>
  );
}
