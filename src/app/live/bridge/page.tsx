import { Suspense } from "react";
import { BridgeView } from "./bridge-view";

export const metadata = { title: "Bridge" };

export default function BridgePage() {
  return (
    <Suspense fallback={<div className="h-72 animate-pulse rounded-[22px] bg-[var(--surface)]" />}>
      <BridgeView />
    </Suspense>
  );
}
