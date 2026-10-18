import { PageShell } from "@/components/page-shell";
import { OpportunitiesView } from "./opportunities-view";

export const metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  return (
    <PageShell
      eyebrow="Jobs, projects, mentors, referrals"
      title={["Opportunities", "_for you_"]}
      lede="Posted by alumni, faculty, founders and recruiters from your college, ranked by how well they fit your skills, goal and intent."
    >
      <OpportunitiesView />
    </PageShell>
  );
}
