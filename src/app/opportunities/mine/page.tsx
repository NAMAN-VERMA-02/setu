import { PageShell } from "@/components/page-shell";
import { MineView } from "./mine-view";

export const metadata = { title: "My posts" };

export default function MinePage() {
  return (
    <PageShell eyebrow="Your openings" title={["My", "_posts_"]} lede="See who is interested, how well they fit, and shortlist the ones you want to talk to.">
      <MineView />
    </PageShell>
  );
}
