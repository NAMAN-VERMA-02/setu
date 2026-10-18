import { PageShell } from "@/components/page-shell";
import { NotificationsView } from "./notifications-view";

export const metadata = { title: "Updates" };

export default function NotificationsPage() {
  return (
    <PageShell eyebrow="Requests, vouches and college news" title={["Your", "_updates_"]} lede="Everything that needs you, in one place. Open one and it is marked as read.">
      <NotificationsView />
    </PageShell>
  );
}
