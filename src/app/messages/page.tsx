import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { createClient } from "@/lib/supabase/server";
import { MessagesView } from "./messages-view";

export const metadata = { title: "Messages" };

async function Inbox() {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <Suspense>
      <MessagesView meId={user.id} />
    </Suspense>
  );
}

export default function MessagesPage() {
  return (
    <PageShell eyebrow="Connected people only" title={["Your", "_messages_"]} lede="Talk to the people you are connected to. One clear question gets a better answer than a long introduction.">
      <Suspense>
        <Inbox />
      </Suspense>
    </PageShell>
  );
}
