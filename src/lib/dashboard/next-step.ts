export type DashboardState = {
  role: string;
  /** Semesters shared in the journey. */
  semesters: number;
  sent: number;
  /** Requests I sent that went past the first question. */
  climbed: boolean;
  /** Requests from others waiting for my answer. */
  waitingOnMe: number;
  succeeded: boolean;
  helpOwed: number;
  // Network and opportunities. Optional so older callers keep working.
  incomingConnections?: number;
  connections?: number;
  myPosts?: number;
  interestsOnMine?: number;
  profilePercent?: number;
  openOpps?: number;
  people?: number;
};

export type NextStep = { title: string; body: string; cta: string; href: string };

const POSTERS = ["alumni", "faculty", "founder", "recruiter"];
export const isPoster = (role: string) => POSTERS.includes(role);
const sharesJourney = (role: string) => role === "student" || role === "alumni";

const POST_COPY: Record<string, { title: string; body: string }> = {
  alumni: { title: "Open a door for a junior", body: "Post a referral, an internship or a mentoring slot. Students whose skills fit will see it first." },
  faculty: { title: "Post a project or research opening", body: "Tell students what you are working on, and which skills would help." },
  founder: { title: "Tell students what you are hiring for", body: "Post a role or a problem to solve. Juniors with the right skills will find it." },
  recruiter: { title: "Post your first opening", body: "Describe the role and the skills you need. Candidates are ranked for you." },
};

/** The single most useful thing to do next, in priority order. */
export function nextStep(s: DashboardState): NextStep {
  if (s.role === "placement") {
    return { title: "See how your college is doing", body: "Engagement, placements and help paid forward, all as counts.", cta: "Open the college dashboard", href: "/college" };
  }
  if (sharesJourney(s.role) && s.semesters === 0) {
    return { title: "Share your journey first", body: "Marks as ranges, a goal and each semester so far. It takes about five minutes and unlocks everything else.", cta: "Start your journey", href: "/onboarding" };
  }
  if (s.waitingOnMe > 0) {
    return {
      title: s.waitingOnMe === 1 ? "One student is waiting on you" : `${s.waitingOnMe} students are waiting on you`,
      body: "A quick answer, or a quiet no, helps them more than silence.",
      cta: "Open your requests",
      href: "/requests",
    };
  }
  if ((s.interestsOnMine ?? 0) > 0) {
    const n = s.interestsOnMine ?? 0;
    return { title: n === 1 ? "Someone is interested in your post" : `${n} people are interested in your posts`, body: "See how well each one fits and shortlist the ones you want to talk to.", cta: "See who is interested", href: "/opportunities/mine" };
  }
  if ((s.incomingConnections ?? 0) > 0) {
    const n = s.incomingConnections ?? 0;
    return { title: n === 1 ? "Someone wants to connect" : `${n} people want to connect`, body: "Accept the ones you know, or decline quietly. They are never told.", cta: "Open your network", href: "/network" };
  }
  if (isPoster(s.role) && s.role !== "alumni" && (s.myPosts ?? 0) === 0) {
    const c = POST_COPY[s.role];
    return { ...c, cta: "Post an opportunity", href: "/opportunities/new" };
  }
  if (s.profilePercent !== undefined && s.profilePercent < 60) {
    return { title: "Make yourself findable", body: `Your profile is ${s.profilePercent}% complete. Add what you know and what you are looking for so the right people find you.`, cta: "Complete your profile", href: "/profile" };
  }
  if (s.succeeded && s.helpOwed > 0) {
    return { title: `Pay it forward: ${s.helpOwed} ${s.helpOwed === 1 ? "answer" : "answers"} to give`, body: "Three juniors stand where you once stood. One answer each.", cta: "Help a junior", href: "/payitforward" };
  }
  if (s.role === "student" && s.sent === 0) {
    return { title: "Meet the seniors who were where you are", body: "See who stood in your exact position and where they went next.", cta: "See your matches", href: "/matches" };
  }
  if (s.role === "student" && !s.climbed) {
    return { title: "Keep the conversation going", body: "Check your requests. A call, then a small task, builds the trust a referral needs.", cta: "Open your requests", href: "/requests" };
  }
  if (isPoster(s.role) && s.role === "alumni" && (s.myPosts ?? 0) === 0) {
    const c = POST_COPY.alumni;
    return { ...c, cta: "Post an opportunity", href: "/opportunities/new" };
  }
  if (s.role === "student" && !s.succeeded) {
    return { title: "Landed something?", body: "Tell us, and help three juniors the way you were helped.", cta: "Share your success", href: "/payitforward" };
  }
  if ((s.connections ?? 0) < 3) {
    return { title: "Grow your network", body: "Search by what people know or offer, and connect with a few.", cta: "Find people", href: "/people" };
  }
  return { title: "You are all caught up", body: "Look at new opportunities and people as your college joins.", cta: "Browse opportunities", href: "/opportunities" };
}

export type ChecklistItem = { label: string; done: boolean; href: string };

export function checklist(s: DashboardState): ChecklistItem[] {
  if (s.role === "student") {
    return [
      { label: "Share your journey", done: s.semesters > 0, href: "/onboarding" },
      { label: "Meet your matches", done: s.sent > 0, href: "/matches" },
      { label: "Send your first question", done: s.sent > 0, href: "/matches" },
      { label: "Climb the trust ladder", done: s.climbed, href: "/requests" },
      { label: "Pay it forward", done: s.succeeded && s.helpOwed === 0, href: "/payitforward" },
    ];
  }
  const items: ChecklistItem[] = [
    { label: "Complete your profile", done: (s.profilePercent ?? 0) >= 80, href: "/profile" },
    { label: "Connect with three people", done: (s.connections ?? 0) >= 3, href: "/people" },
  ];
  if (isPoster(s.role)) items.push({ label: "Post an opportunity", done: (s.myPosts ?? 0) > 0, href: "/opportunities/new" });
  if (sharesJourney(s.role)) items.push({ label: "Share your journey", done: s.semesters > 0, href: "/onboarding" });
  if (s.role === "alumni") items.push({ label: "Pay it forward", done: s.succeeded && s.helpOwed === 0, href: "/payitforward" });
  return items;
}

/** Branches typed as short codes (cse, it) read better in capitals. */
export function formatBranch(branch: string): string {
  const b = branch.trim();
  return b.length <= 4 ? b.toUpperCase() : b;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
