"use client";

import { CollegeDashboard } from "@/components/college/college-dashboard";
import { PayForwardBoard } from "@/components/payitforward/pay-forward-board";
import type { CollegeStats } from "@/lib/college/stats";
import type { PayItForwardResponse } from "@/lib/validation/payforward";

const data: PayItForwardResponse = {
  succeeded: true,
  company: "Cognizant",
  helpOwed: 2,
  answered: 1,
  candidates: [
    { id: "j1", displayName: "Aarav Sharma (sample)", batch: 2027, branch: "CSE", goalTarget: "SDE at Cognizant", semester: 5, question: "How did you prepare for the online coding test?", firstLine: "You also had 1 backlog in semester 5." },
    { id: "j2", displayName: "Diya Gupta (sample)", batch: 2027, branch: "IT", goalTarget: "SDE at TCS", semester: 5, question: "Was my backlog a problem in interviews?", firstLine: "In semester 5 you were both aiming for a job." },
  ],
  received: [
    { id: "r1", question: "Which one project helped you most in interviews?", answer: "A small expense tracker with a real database. Interviewers kept asking about it, so pick one and know it deeply.", helper: { batch: 2024, branch: "CSE" }, createdAt: "2026-10-10T00:00:00Z" },
  ],
};

const stats: CollegeStats = {
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
    { company: "Infosys", count: 8 },
  ],
  helps: 12,
  helpers: 6,
  help_owed_open: 6,
};

export function Preview() {
  const handlers = {
    reportSuccess: async () => ({ ok: true }),
    answer: async () => ({ ok: true }),
    onChanged: () => {},
  };
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14 space-y-16">
      <h1 className="text-5xl font-black uppercase leading-none tracking-tight sm:text-7xl">
        Pay it
        <br className="hidden sm:block" /> forward ×3
      </h1>
      <PayForwardBoard data={data} handlers={handlers} />
      <h1 className="text-5xl font-black uppercase leading-none tracking-tight sm:text-7xl">
        Your college
        <br className="hidden sm:block" /> on SETU
      </h1>
      <CollegeDashboard stats={stats} />
    </main>
  );
}
