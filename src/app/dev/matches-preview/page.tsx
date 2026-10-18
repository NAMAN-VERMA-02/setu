import { notFound } from "next/navigation";
import { MatchResults } from "@/components/matches/match-results";
import type { Match } from "@/lib/scoring";
import type { MatchResponse } from "@/lib/scoring/response";

// Design preview with made-up data. Not available in production builds.
const match = (id: string, name: string, over: Partial<Match>): Match => ({
  id,
  displayName: name,
  batch: 2024,
  branch: "CSE",
  semester: 5,
  score: 85,
  rarityBonus: 6,
  sharedTraits: ["tier", "branch", "backlogs", "decision"],
  firstLine: "You also had 1 backlog in semester 5.",
  routes: [{ type: "direct", hops: 1, rank: 80 }],
  rank: 80,
  ...over,
});

const fixture: MatchResponse = {
  semester: 5,
  total: 14,
  bridgeBlocked: false,
  routeMap: {
    total: 14,
    branches: [
      { decision: "job", label: "Job", count: 6, destinations: [{ label: "Cognizant", count: 3 }, { label: "TCS", count: 2 }, { label: "Other companies", count: 1 }] },
      { decision: "gate", label: "GATE / exams", count: 5, destinations: [] },
      { decision: "startup", label: "Startup", count: 3, destinations: [{ label: "Early-stage startups", count: 3 }] },
    ],
  },
  matches: [
    match("a", "Amit Sharma (sample)", {
      routes: [
        { type: "direct", hops: 1, rank: 80 },
        { type: "via_senior", hops: 2, rank: 48, company: "Cognizant", contactCount: 3 },
      ],
    }),
    match("b", "Riya Verma (sample)", { batch: 2023, branch: "IT", score: 70, firstLine: "In semester 5 you were both aiming for a job.", sharedTraits: ["tier", "decision", "cgpa"] }),
    match("c", "Kabir Singh (sample)", { batch: 2025, score: 65, firstLine: "You both finished semester 5 with no backlogs.", sharedTraits: ["tier", "branch"] }),
  ],
};

export default function Preview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="mb-8 text-5xl font-black uppercase leading-none tracking-tight sm:text-7xl">
        Where you are, <br className="hidden sm:block" />
        where they went
      </h1>
      <MatchResults data={fixture} demo />
    </main>
  );
}
