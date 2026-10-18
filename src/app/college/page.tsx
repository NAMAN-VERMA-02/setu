import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CollegeDashboard } from "@/components/college/college-dashboard";
import { PageShell } from "@/components/page-shell";
import type { CollegeStats } from "@/lib/college/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "College dashboard" };

async function Stats() {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The database function only answers for the placement cell of the caller's own college.
  const { data, error } = await supabase.rpc("college_stats");
  if (error || !data) {
    return (
      <p className="rounded-[22px] bg-white p-6">
        This page is for your college&apos;s placement cell. If you should have access, ask SETU to switch your
        account to the placement role.
      </p>
    );
  }
  return <CollegeDashboard stats={data as CollegeStats} />;
}

export default function CollegePage() {
  return (
    <PageShell
      eyebrow="For the placement cell"
      title={["Your college", "_on SETU_"]}
      lede="Engagement, how far requests climb the trust ladder, placements and help paid forward. Counts only."
    >
      <Suspense>
        <Stats />
      </Suspense>
    </PageShell>
  );
}
