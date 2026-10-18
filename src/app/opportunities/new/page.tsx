import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { canPost } from "@/lib/validation/opportunities";
import { NewOpportunityForm } from "./new-form";

export const metadata = { title: "Post an opportunity" };

async function Gate() {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (!me || !canPost(me.role)) {
    return (
      <p className="max-w-xl rounded-[22px] bg-white p-6">
        Opportunities are posted by alumni, faculty, founders, recruiters and the placement cell. You can browse and
        show interest on the{" "}
        <Link href="/opportunities" className="font-semibold underline">
          board
        </Link>
        .
      </p>
    );
  }
  return <NewOpportunityForm />;
}

export default function NewOpportunityPage() {
  return (
    <PageShell eyebrow="Give someone a start" title={["Post an", "_opportunity_"]} lede="Jobs, internships, projects, research, referrals, mentorship or events. Students and juniors who fit will see it first.">
      <Suspense>
        <Gate />
      </Suspense>
    </PageShell>
  );
}
