import { Suspense } from "react";
import { connection } from "next/server";
import { AppHeader } from "@/components/app-header";
import { Hero } from "@/components/hero";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";

type Props = {
  eyebrow?: string;
  title: string[];
  lede?: React.ReactNode;
  children: React.ReactNode;
};

async function Inner({ eyebrow, title, lede, children }: Props) {
  await connection(); // the session check reads the clock, so render per request
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <>
      <AppHeader role={profile?.role ?? "student"} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <Hero eyebrow={eyebrow} lines={title} lede={lede} />
        <div className="rise" style={{ "--d": "0.7s" } as React.CSSProperties}>
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Layout for every signed-in page: floating header, big title, content, ticker. */
export function PageShell(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <Inner {...props} />
    </Suspense>
  );
}
