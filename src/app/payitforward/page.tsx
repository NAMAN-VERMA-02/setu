import { PageShell } from "@/components/page-shell";
import { PayItForwardView } from "./payitforward-view";

export const metadata = { title: "Pay it forward" };

export default function PayItForwardPage() {
  return (
    <PageShell
      eyebrow="Give back, three times"
      title={["Pay it", "_forward_ ×3"]}
      lede="Someone stood where you stand and showed you the way. When you land, answer three juniors the same way."
    >
      <PayItForwardView />
    </PageShell>
  );
}
