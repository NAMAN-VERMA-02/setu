import { PageShell } from "@/components/page-shell";
import { NetworkView } from "./network-view";

export const metadata = { title: "Your network" };

export default function NetworkPage() {
  return (
    <PageShell
      eyebrow="Students, alumni, faculty, founders, recruiters, institution"
      title={["Your", "_network_"]}
      lede="Everyone you are connected to, grouped the way they help you. Quiet declines, no spam, and nothing is shared beyond your college."
    >
      <NetworkView />
    </PageShell>
  );
}
