import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementsView } from "./announcements-view";

export const metadata = { title: "Announcements" };

async function Board() {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  return <AnnouncementsView canPost={me?.role === "placement"} />;
}

export default function AnnouncementsPage() {
  return (
    <PageShell eyebrow="From your college" title={["News &", "_events_"]} lede="What the placement cell wants you to know: drives, alumni meets and deadlines.">
      <Suspense>
        <Board />
      </Suspense>
    </PageShell>
  );
}
