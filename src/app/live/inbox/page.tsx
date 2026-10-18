import { Suspense } from "react";
import { InboxView } from "./inbox-view";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-[22px] bg-[var(--surface)]" />}>
      <InboxView />
    </Suspense>
  );
}
