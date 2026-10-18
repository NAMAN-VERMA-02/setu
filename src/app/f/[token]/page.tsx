import { Suspense } from "react";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";
import { lookupForward } from "@/lib/asks/forward";
import { replyAction } from "./actions";

export const metadata = {
  title: "A request for your advice",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

async function Request({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await lookupForward(token);

  if (!view) {
    return (
      <>
        <h1 className="mb-3 text-4xl font-black uppercase tracking-tight">This link has ended</h1>
        <p className="text-[var(--muted)]">
          Links last 7 days and can be used once. If you still want to help, ask whoever sent it for a new one.
        </p>
      </>
    );
  }

  if (view.status === "replied") {
    return (
      <>
        <h1 className="mb-3 text-4xl font-black uppercase tracking-tight">Thank you</h1>
        <p className="mb-6">
          {view.asker_first_name} has been told you are happy to help. If you would like to pay it forward too,
          you can share your own journey with students in your position.
        </p>
        <Link href="/signup" className="rounded-full bg-[var(--ink)] px-6 py-3 font-semibold text-white">
          Join SETU
        </Link>
      </>
    );
  }

  const reply = replyAction.bind(null, token);
  return (
    <>
      <p className="mb-2 text-sm text-[var(--muted)]">A student from your college asks</p>
      <h1 className="mb-6 text-4xl font-black uppercase leading-none tracking-tight">
        Can you help {view.asker_first_name}?
      </h1>

      <div className="mb-6 space-y-3 rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        {view.goal && (
          <p>
            <span className="font-semibold">Goal:</span> {view.goal}
          </p>
        )}
        {view.target_company && (
          <p>
            <span className="font-semibold">Company:</span> {view.target_company}
          </p>
        )}
        <p className="whitespace-pre-wrap border-l-4 border-[var(--yellow)] pl-3">{view.message}</p>
        {view.work_url && (
          <p>
            <a href={view.work_url} rel="noopener noreferrer nofollow" target="_blank" className="underline">
              See their work
            </a>
          </p>
        )}
      </div>

      <form action={reply} className="space-y-4">
        <div>
          <label htmlFor="note" className="mb-1 block text-sm font-medium">
            A short note (optional)
          </label>
          <textarea
            id="note"
            name="note"
            maxLength={500}
            rows={3}
            className="w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
          />
        </div>
        <button type="submit" className="w-full rounded-full bg-[var(--ink)] px-6 py-3 text-base font-semibold text-white">
          I can help
        </button>
      </form>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Not a fit? Just close this page. Nobody is told, and the link expires on its own.
      </p>
    </>
  );
}

export default function ForwardPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <>
      <PublicHeader minimal />
      <main className="mx-auto w-full max-w-xl px-4 pb-20 pt-10 sm:pt-16">
        <div className="rise rounded-[22px] bg-white p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08),0_30px_60px_-40px_rgba(15,15,14,.35)] sm:p-8" style={{ "--d": "0.2s" } as React.CSSProperties}>
          <Suspense>
            <Request params={params} />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
