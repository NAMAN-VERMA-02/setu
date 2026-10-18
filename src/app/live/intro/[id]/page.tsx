import { Suspense } from "react";
import { IntroView } from "./intro-view";

export const metadata = { title: "Your intro" };

export default function IntroPage({ params }: PageProps<"/live/intro/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[22px] bg-[var(--surface)]" />}>
      <IntroView paramsPromise={params} />
    </Suspense>
  );
}
