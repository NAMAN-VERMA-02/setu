import { Suspense } from "react";
import { StageView } from "./stage-view";

export const metadata = { title: "Stage control", robots: { index: false, follow: false } };

export default function StagePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <StageView />
    </Suspense>
  );
}
