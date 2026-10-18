import { Suspense } from "react";
import { PlainScreen } from "@/components/fx/plain-screen";
import { LiveHeader } from "@/components/live/live-header";
import { StageOverlay } from "@/components/live/stage-overlay";

export const metadata = { title: "Live Network" };

export default function LiveLayout({ children }: LayoutProps<"/live">) {
  return (
    <>
      <PlainScreen />
      <Suspense fallback={<div className="h-28 border-b border-[var(--ink)]/10" />}>
        <LiveHeader />
      </Suspense>
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 text-lg sm:px-6">{children}</main>
      <StageOverlay />
    </>
  );
}
