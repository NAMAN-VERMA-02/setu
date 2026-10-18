import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { InvitesView } from "./invites-view";

export const metadata = { title: "Invites" };

async function Gate() {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!me || !["alumni", "faculty", "placement"].includes(me.role)) {
    return <p className="max-w-xl rounded-[22px] bg-white p-6">Alumni, faculty and the placement cell can invite recruiters and founders to the network.</p>;
  }
  return <InvitesView />;
}

export default function InvitesPage() {
  return (
    <PageShell eyebrow="Vouch for people you trust" title={["Bring in", "_recruiters_"]} lede="Single-use links for recruiters and founders. They join your college's network because someone from it vouched for them.">
      <Suspense>
        <Gate />
      </Suspense>
    </PageShell>
  );
}
