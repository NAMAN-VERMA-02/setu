import { Suspense } from "react";
import { HopView } from "./hop-view";

export const metadata = { title: "Help with an intro" };

export default function HopPage({ params }: PageProps<"/h/[token]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-48 max-w-xl animate-pulse rounded-2xl bg-[var(--surface)]" />}>
      <HopView paramsPromise={params} />
    </Suspense>
  );
}
