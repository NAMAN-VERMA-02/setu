import { Suspense } from "react";
import { CollegeView } from "./college-view";

export const metadata = { title: "College dashboard" };

export default function CollegePage({ params }: PageProps<"/live/college/[node]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-[22px] bg-[var(--surface)]" />}>
      <CollegeView paramsPromise={params} />
    </Suspense>
  );
}
