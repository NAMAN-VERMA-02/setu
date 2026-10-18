import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { JourneyForm, type InitialJourney } from "./journey-form";

export const metadata = { title: "Your journey" };

async function Journey() {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: goal }, { data: snaps }] = await Promise.all([
    supabase.from("goals").select("target, company, open_question").eq("user_id", user.id).maybeSingle(),
    supabase.from("snapshots").select("*").eq("user_id", user.id).order("semester"),
  ]);

  const first = snaps?.[0];
  const initial: InitialJourney = {
    goalTarget: goal?.target ?? "",
    goalCompany: goal?.company ?? "",
    goalQuestion: goal?.open_question ?? "",
    tenthRange: first?.tenth_range ?? "",
    twelfthRange: first?.twelfth_range ?? "",
    showTenth: first?.show_tenth ?? false,
    showTwelfth: first?.show_twelfth ?? false,
    currentSemester: snaps?.length ? Math.max(...snaps.map((s) => s.semester)) : 1,
    rows: Object.fromEntries(
      (snaps ?? []).map((s) => [
        s.semester,
        {
          cgpaRange: s.cgpa_range ?? "",
          backlogCount: String(s.backlog_count),
          skills: (s.skills ?? []).join(", "),
          status: s.status ?? "",
          decision: s.decision ?? "",
          showCgpa: s.show_cgpa,
        },
      ]),
    ),
  };

  return <JourneyForm initial={initial} />;
}

export default function OnboardingPage() {
  return (
    <PageShell
      eyebrow="About five minutes"
      title={["Your", "_journey_"]}
      lede={
        <>
          Share where you are, semester by semester. SETU uses it to find seniors who stood exactly here.{" "}
          <Link href="/dashboard" className="underline">
            Skip for now
          </Link>
        </>
      }
    >
      <div className="max-w-2xl">
        <Suspense>
          <Journey />
        </Suspense>
      </div>
    </PageShell>
  );
}
