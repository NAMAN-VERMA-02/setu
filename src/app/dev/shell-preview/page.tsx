import { notFound } from "next/navigation";
import { CollegeDashboard } from "@/components/college/college-dashboard";
import { PageShell } from "@/components/page-shell";

// Preview of the shared signed-in frame with made-up data. Not available in production builds.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PageShell
      eyebrow="For the placement cell"
      title={["Your college", "on SETU"]}
      lede="Engagement, how far requests climb the trust ladder, placements and help paid forward. Counts only."
    >
      <CollegeDashboard
        stats={{
          members: { alumni: 131, student: 19, placement: 1 },
          students: 19,
          journeys_shared: 19,
          students_asked: 19,
          students_replied: 18,
          asks_total: 19,
          ladder: { question: 19, call: 16, task: 10, referral: 3 },
          placed: 73,
          top_companies: [
            { company: "Cognizant", count: 12 },
            { company: "TCS", count: 10 },
          ],
          helps: 12,
          helpers: 6,
          help_owed_open: 6,
        }}
      />
    </PageShell>
  );
}
