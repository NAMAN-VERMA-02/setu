/**
 * Deterministic demo history so the placement dashboard and leaderboard look lived-in.
 * Last 7 days: 142 intros, 68% hop acceptance, 9 hires. Previous 7 days: 118 intros.
 * History rows are flagged is_history and never use story people, so the live story is unaffected.
 */

export type DirPerson = { pid: string; node_id: string; role: string; story_key: string | null };

export type HistoryIntro = {
  id: string;
  requester: string;
  target: string;
  status: "hired" | "delivered" | "failed";
  trust_step: "question" | "call" | "referral";
  response: "question" | "call" | "referral" | null;
  success_prob: number;
  shortest_prob: number;
  is_history: true;
  created_at: string;
  completed_at: string | null;
};
export type HistoryHop = {
  intro_id: string;
  idx: number;
  from_pid: string;
  to_pid: string;
  status: "accepted" | "declined" | "cancelled";
  is_target: boolean;
  sent_at: string;
  responded_at: string | null;
};
export type HistoryLedger = { pid: string; points: number; karz: number; reason: string };

/** Ledger totals of the story people (points, karz). Scores must match the round-1 slide. */
export const STORY_LEDGER: Record<string, { points: number; karz: number }> = {
  aman: { points: 40, karz: 140 },
  rohan: { points: 980, karz: 15 },
  priya: { points: 1240, karz: 0 },
  arjun: { points: 2310, karz: 0 },
  kavya: { points: 1875, karz: 0 },
  sneha: { points: 610, karz: 40 },
  // the professional network's story people
  ananya: { points: 120, karz: 30 },
  rahul: { points: 640, karz: 0 },
  ishaan: { points: 310, karz: 20 },
  meenakshi: { points: 420, karz: 0 },
  zoya: { points: 260, karz: 10 },
};

type Week = { total: number; hired: number; delivered: number; declinedSecond: number; declinedFirst: number };
export const THIS_WEEK: Week = { total: 142, hired: 9, delivered: 55, declinedSecond: 38, declinedFirst: 40 };
export const LAST_WEEK: Week = { total: 118, hired: 8, delivered: 46, declinedSecond: 32, declinedFirst: 32 };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable, valid-looking v4 uuid from a counter, so re-running the seed gives the same ids. */
function uuid(n: number): string {
  const hex = (n + 0x100000000).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex.slice(-12)}`;
}

export function buildHistory(people: DirPerson[], now: Date): { intros: HistoryIntro[]; hops: HistoryHop[]; ledger: HistoryLedger[] } {
  const free = people.filter((p) => !p.story_key && p.role !== "placement");
  const students = free.filter((p) => p.role === "student");
  const alums = free.filter((p) => p.role === "alum");
  if (students.length < 3 || alums.length < 6) throw new Error("not enough generated people for history");

  const random = rng(20261018);
  const pick = <T>(xs: T[]) => xs[Math.floor(random() * xs.length)];
  const intros: HistoryIntro[] = [];
  const hops: HistoryHop[] = [];
  let counter = 1;
  const DAY = 86_400_000;

  const addWeek = (week: Week, startDay: number) => {
    // outcome per intro, shuffled deterministically
    const outcomes: ("hired" | "delivered" | "x2" | "x1")[] = [
      ...Array(week.hired).fill("hired"),
      ...Array(week.delivered).fill("delivered"),
      ...Array(week.declinedSecond).fill("x2"),
      ...Array(week.declinedFirst).fill("x1"),
    ];
    for (let i = outcomes.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
    }

    outcomes.forEach((outcome, i) => {
      const day = startDay + (i % 7); // every day of the week gets intros
      const created = new Date(now.getTime() - day * DAY - Math.floor(random() * 20 * 3_600_000) - 3_600_000);
      const requester = pick(students);
      const target = pick(alums.filter((a) => a.pid !== requester.pid));
      const mid = pick(alums.filter((a) => a.pid !== target.pid));
      const id = uuid(counter++);
      const respond = (hours: number) => new Date(created.getTime() + hours * 3_600_000).toISOString();
      const sent = created.toISOString();
      const finished = outcome === "hired" || outcome === "delivered";

      intros.push({
        id,
        requester: requester.pid,
        target: target.pid,
        status: outcome === "hired" ? "hired" : finished ? "delivered" : "failed",
        trust_step: "question",
        response: finished ? "question" : null,
        success_prob: Math.round((0.2 + random() * 0.4) * 1000) / 1000,
        shortest_prob: Math.round((0.05 + random() * 0.15) * 1000) / 1000,
        is_history: true,
        created_at: sent,
        completed_at: finished ? respond(6 + random() * 40) : null,
      });
      const first = outcome === "x1" ? "declined" : "accepted";
      hops.push({ intro_id: id, idx: 1, from_pid: requester.pid, to_pid: mid.pid, status: first, is_target: false, sent_at: sent, responded_at: respond(1 + random() * 8) });
      hops.push({
        intro_id: id,
        idx: 2,
        from_pid: mid.pid,
        to_pid: target.pid,
        status: outcome === "x1" ? "cancelled" : outcome === "x2" ? "declined" : "accepted",
        is_target: true,
        sent_at: respond(2),
        responded_at: outcome === "x1" ? null : respond(3 + random() * 12),
      });
    });
  };
  addWeek(THIS_WEEK, 0);
  addWeek(LAST_WEEK, 7);

  // Everyone gets a believable ledger. Generated people stay below the story top 5.
  const ledger: HistoryLedger[] = [];
  for (const p of people) {
    if (p.role === "placement") continue;
    const story = p.story_key ? STORY_LEDGER[p.story_key] : undefined;
    if (story) {
      if (story.points) ledger.push({ pid: p.pid, points: story.points, karz: 0, reason: "history" });
      if (story.karz) ledger.push({ pid: p.pid, points: 0, karz: story.karz, reason: "history" });
    } else if (!p.story_key) {
      const points = p.role === "alum" || p.role === "professional" ? Math.floor(random() * 480) : Math.floor(random() * 220);
      const karz = p.role === "student" ? Math.floor(random() * 60) : 0;
      if (points) ledger.push({ pid: p.pid, points, karz: 0, reason: "history" });
      if (karz) ledger.push({ pid: p.pid, points: 0, karz, reason: "history" });
    }
  }
  return { intros, hops, ledger };
}

/** Summary used by tests and the dashboard sanity check. */
export function summarise(h: { intros: HistoryIntro[]; hops: HistoryHop[] }, now: Date, days = 7) {
  const since = now.getTime() - days * 86_400_000;
  const ids = new Set(h.intros.filter((i) => new Date(i.created_at).getTime() >= since).map((i) => i.id));
  const recent = h.hops.filter((x) => ids.has(x.intro_id) && x.status !== "cancelled");
  const accepted = recent.filter((x) => x.status === "accepted").length;
  return {
    intros: ids.size,
    acceptance: Math.round((accepted / recent.length) * 100),
    hires: h.intros.filter((i) => ids.has(i.id) && i.status === "hired").length,
  };
}
