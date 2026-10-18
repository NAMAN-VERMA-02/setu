import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";

// Design preview with made-up data. Not available in production builds.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <DashboardView
      data={{
        fullName: "Naman Verma",
        role: "student",
        branch: "cse",
        batch: 2028,
        verified: true,
        answersReceived: 2,
        state: { role: "student", semesters: 5, sent: 2, climbed: true, waitingOnMe: 3, succeeded: false, helpOwed: 0 },
      }}
    />
  );
}
