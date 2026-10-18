import { PageShell } from "@/components/page-shell";
import { PeopleView } from "./people-view";

export const metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <PageShell
      eyebrow="A network, not a directory"
      title={["Find the", "_right_ people"]}
      lede="Ask in plain words. SETU matches on what people know, what they offer and what they are open to, and tells you why."
    >
      <PeopleView />
    </PageShell>
  );
}
