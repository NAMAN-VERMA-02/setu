"use client";

import { useState } from "react";
import { NetworkBoard } from "@/components/network/network-board";
import { ConnectButton } from "@/components/people/connect-button";
import { PeopleList } from "@/components/people/people-list";
import { OpportunityFeed } from "@/components/opportunities/opportunity-feed";
import type { ConnItem, ConnectionsResponse } from "@/lib/connections/types";
import type { FeedOpp } from "@/lib/opportunities/types";
import type { PersonCard } from "@/lib/people/types";

const person = (id: string, name: string, role: string, extra: Partial<ConnItem["person"]> = {}): ConnItem => ({
  id: `c-${id}`,
  message: null,
  createdAt: "2026-10-10T00:00:00Z",
  person: { id, name, role, headline: null, batch: 2024, branch: "CSE", company: null, ...extra },
});

const connections: ConnectionsResponse = {
  connected: [
    person("a1", "Amit Sharma (sample)", "alumni", { headline: "Software Engineer at Zoho" }),
    person("a2", "Riya Verma (sample)", "alumni"),
    person("a3", "Kabir Singh (sample)", "alumni"),
    person("f1", "Dr. Meera Jain (sample)", "faculty", { headline: "Professor, Machine Learning" }),
    person("f2", "Dr. Rahul Gupta (sample)", "faculty"),
    person("x1", "Tanvi Yadav (sample)", "founder", { headline: "Founder at Learnloop" }),
    person("r1", "Isha Pandey (sample)", "recruiter", { headline: "Talent acquisition at Cognizant" }),
    person("s1", "Aarav Tiwari (sample)", "student"),
    person("s2", "Diya Saxena (sample)", "student"),
    person("p1", "Placement Cell (sample)", "placement"),
  ],
  incoming: [{ ...person("r2", "Karan Bansal (sample)", "recruiter", { headline: "Talent acquisition at TCS" }), message: "Saw your profile, would love to connect." }],
  outgoing: [person("x2", "Neha Rastogi (sample)", "founder")],
};

const people: PersonCard[] = [
  { id: "p-a", name: "Amit Sharma (sample)", role: "alumni", batch: 2023, branch: "CSE", headline: "Software Engineer at Zoho", company: "Zoho", title: "Software Engineer", expertise: ["GATE", "DSA", "SQL"], openTo: ["mentoring", "advice"], intents: [{ kind: "offer", category: "mentoring", statement: "GATE mentoring for CSE juniors" }], reasons: ["Knows gate", "Offers: GATE mentoring for CSE juniors", "Open to mentoring and advice"], connection: "none" },
  { id: "p-b", name: "Dr. Meera Jain (sample)", role: "faculty", batch: 2005, branch: "CSE", headline: "Professor, Machine Learning", company: null, title: "Professor", expertise: ["Machine Learning", "Data Mining"], openTo: ["projects"], intents: [{ kind: "offer", category: "research", statement: "Guiding final-year projects in Machine Learning" }], reasons: ["Offers: Guiding final-year projects in Machine Learning"], connection: "connected" },
];

const opps: FeedOpp[] = [
  { id: "o1", kind: "internship", title: "Intern, React", description: "Join a small team and ship something real. You will own a feature end to end and learn fast.", company: "Learnloop", skills: ["React", "Node.js", "Git"], mode: "hybrid", location: "Noida", createdAt: "2026-10-15T00:00:00Z", deadline: "2026-11-20", poster: { id: "x1", name: "Tanvi Yadav (sample)", role: "founder", headline: null }, interest: null, score: 62, reasons: ["Uses your skills: React, SQL", "Posted 3 days ago"] },
  { id: "o2", kind: "referral", title: "Referral and mentoring at Cognizant", description: "I can refer strong juniors after a short call and a small task.", company: "Cognizant", skills: ["Java", "SQL"], mode: "onsite", location: "Gurugram", createdAt: "2026-10-12T00:00:00Z", deadline: null, poster: { id: "a1", name: "Amit Sharma (sample)", role: "alumni", headline: null }, interest: "seen", score: 58, reasons: ["At your target company, Cognizant"] },
];

export function NetworkPreview() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [openTo, setOpenTo] = useState("");
  const [kind, setKind] = useState("");
  return (
    <main className="mx-auto w-full max-w-6xl space-y-16 px-4 py-10 sm:px-6">
      <h1 className="text-5xl font-black uppercase tracking-tight">Network preview</h1>
      <section><h2 className="mb-4 text-2xl font-black uppercase">Network</h2><NetworkBoard data={connections} onAct={async () => true} youLabel="You" /></section>
      <section><h2 className="mb-4 text-2xl font-black uppercase">People</h2>
        <PeopleList people={people} loading={false} q={q} role={role} openTo={openTo} onQuery={setQ} onRole={setRole} onOpenTo={setOpenTo} action={(p) => <ConnectButton userId={p.id} initial={p.connection} demo />} />
      </section>
      <section><h2 className="mb-4 text-2xl font-black uppercase">Opportunities</h2>
        <OpportunityFeed items={opps} canPost kind={kind} q={q} onKind={setKind} onQuery={setQ} onInterest={async () => ({ ok: true })} />
      </section>
    </main>
  );
}
