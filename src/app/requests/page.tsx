import { PageShell } from "@/components/page-shell";
import { RequestsView } from "./requests-view";

export const metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <PageShell
      eyebrow="Trust, one step at a time"
      title={["Your", "_requests_"]}
      lede="A question, then a call, then a small task. A referral only unlocks once your work has been seen."
    >
      <RequestsView />
    </PageShell>
  );
}
