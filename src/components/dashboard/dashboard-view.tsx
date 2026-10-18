import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { checklist, firstName, formatBranch, nextStep, type DashboardState } from "@/lib/dashboard/next-step";
import { CountUp } from "./count-up";

export type DashboardData = {
  fullName: string;
  role: string;
  branch: string;
  batch: number;
  verified: boolean;
  state: DashboardState;
  answersReceived: number;
};

function Tile({
  href,
  tone,
  dark,
  label,
  big,
  sub,
  delay,
}: {
  href: string;
  tone: string;
  dark?: boolean;
  label: string;
  big: React.ReactNode;
  sub: string;
  delay: string;
}) {
  return (
    <li className="rise" style={{ "--d": delay } as React.CSSProperties}>
      <Link
        href={href}
        className="tile group relative flex h-full min-h-48 flex-col justify-between rounded-[22px] p-5 outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
        style={{ background: tone, color: dark ? "var(--on-ink)" : "var(--ink)" }}
      >
        <div className="flex items-start justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide">{label}</span>
          <span
            className="tile-arrow grid size-9 place-items-center rounded-full text-lg"
            style={{ background: dark ? "var(--on-ink)" : "var(--ink)", color: dark ? "var(--ink)" : "var(--on-ink)" }}
            aria-hidden="true"
          >
            →
          </span>
        </div>
        <div>
          <p className="text-6xl font-black leading-none tracking-tight">{big}</p>
          <p className="mt-2 text-sm opacity-80">{sub}</p>
        </div>
      </Link>
    </li>
  );
}

type TileSpec = { href: string; tone: string; dark?: boolean; label: string; big: React.ReactNode; sub: string };

/** The shortcuts shown for each kind of person. */
function tilesFor(data: DashboardData): TileSpec[] {
  const st = data.state;
  const opps: TileSpec = { href: "/opportunities", tone: "var(--yellow)", label: "Opportunities", big: <CountUp to={st.openOpps ?? 0} />, sub: "open to your college, ranked for you" };
  const people: TileSpec = { href: "/people", tone: "var(--sage)", label: "People", big: <CountUp to={st.people ?? 0} />, sub: "to find by what they know and offer" };
  const network: TileSpec = { href: "/network", tone: "var(--stone)", label: "Network", big: <CountUp to={st.connections ?? 0} />, sub: `connections${st.incomingConnections ? ` · ${st.incomingConnections} waiting` : ""}` };
  const profile: TileSpec = { href: "/profile", tone: "var(--surface)", label: "Your profile", big: `${st.profilePercent ?? 0}%`, sub: "complete · be easy to find" };
  const requests: TileSpec = { href: "/requests", tone: "var(--yellow)", label: "Requests", big: <CountUp to={st.waitingOnMe} />, sub: `waiting on you · ${st.sent} sent by you` };
  const payForward: TileSpec = {
    href: "/payitforward",
    tone: "var(--red-tile)",
    label: "Pay it forward",
    big: st.succeeded && st.helpOwed > 0 ? <CountUp to={st.helpOwed} /> : "×3",
    sub: st.succeeded && st.helpOwed > 0 ? "answers left to give" : `${data.answersReceived} answers received so far`,
  };
  const posts: TileSpec = { href: "/opportunities/mine", tone: "var(--red-tile)", label: "My posts", big: <CountUp to={st.myPosts ?? 0} />, sub: `open · ${st.interestsOnMine ?? 0} interested` };

  switch (data.role) {
    case "student":
      return [
        { href: "/matches", tone: "var(--blue)", label: "Your matches", big: "Meet", sub: "Seniors who were exactly where you are" },
        opps, people, network, requests, payForward, profile,
        { href: "/onboarding", tone: "var(--surface)", label: "Your journey", big: <CountUp to={st.semesters} />, sub: "semesters shared · edit any time" },
      ];
    case "alumni":
      return [people, opps, network, requests, posts, payForward, profile, { href: "/invites", tone: "var(--blue)", label: "Invites", big: "Vouch", sub: "bring in recruiters and founders" }];
    case "placement":
      return [
        { href: "/college", tone: "var(--ink)", dark: true, label: "College", big: "Stats", sub: "Engagement and outcomes at a glance" },
        { href: "/invites", tone: "var(--blue)", label: "Invites", big: "Vouch", sub: "bring in recruiters and founders" },
        opps, people, network, profile,
      ];
    case "faculty":
      return [posts, people, opps, network, profile, { href: "/invites", tone: "var(--blue)", label: "Invites", big: "Vouch", sub: "bring in recruiters and founders" }];
    default:
      // founders and recruiters
      return [posts, people, opps, network, profile];
  }
}

const HOW = [
  { n: "01", title: "Match on the “then”", text: "SETU compares you with seniors’ snapshots from the exact semester you are in, not where they work today." },
  { n: "02", title: "Reach them through someone they trust", text: "If a senior knows people at your target company, they can pass your question on. Never more than one bridge." },
  { n: "03", title: "Earn trust, step by step", text: "A question, then a call, then a small task. A referral unlocks only after they have seen your work." },
];

/** Signed-in home: where you stand, what to do next, and where everything lives. */
export function DashboardView({ data }: { data: DashboardData }) {
  const { state } = data;
  const next = nextStep(state);
  const steps = checklist(state);
  const doneCount = steps.filter((s) => s.done).length;
  const first = firstName(data.fullName);
  const tiles = tilesFor(data);

  return (
    <>
      <AppHeader role={data.role} />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Hero */}
        <section aria-labelledby="hello">
          <ul className="rise mb-6 flex flex-wrap gap-2 text-sm" style={{ "--d": "0.15s" } as React.CSSProperties}>
            <li className="rounded-full bg-white px-3 py-1 font-medium capitalize shadow-[0_0_0_1px_rgba(15,15,14,.08)]">{data.role}</li>
            <li className="rounded-full bg-white px-3 py-1 font-medium shadow-[0_0_0_1px_rgba(15,15,14,.08)]">{formatBranch(data.branch)}</li>
            <li className="rounded-full bg-white px-3 py-1 font-medium shadow-[0_0_0_1px_rgba(15,15,14,.08)]">Batch {data.batch}</li>
            {data.verified && <li className="rounded-full bg-[var(--blue)] px-3 py-1 font-semibold">✓ College email verified</li>}
          </ul>

          <h1 id="hello" className="text-[clamp(3.5rem,13vw,10rem)] font-black uppercase leading-[0.86] tracking-[-0.04em]">
            <span className="mask-line" style={{ "--d": "0.2s" } as React.CSSProperties}>
              <span>Hello,</span>
            </span>
            <span className="mask-line" style={{ "--d": "0.32s" } as React.CSSProperties}>
              <span>{first}.</span>
            </span>
          </h1>

          <p className="rise mt-6 max-w-xl text-lg text-[var(--muted)]" style={{ "--d": "0.6s" } as React.CSSProperties}>
            Their yesterday is your tomorrow. Here is where you stand, and the one thing worth doing next.
          </p>
        </section>

        {/* Next step */}
        <section aria-labelledby="next-h" className="rise mt-10" style={{ "--d": "0.75s" } as React.CSSProperties}>
          <div className="flex flex-col gap-6 rounded-[22px] bg-[var(--ink)] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-2xl">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--yellow)]">
                <span className="pulse-dot inline-block size-2.5 rounded-full bg-[var(--yellow)]" aria-hidden="true" />
                Your next step
              </p>
              <h2 id="next-h" className="text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">
                {next.title}
              </h2>
              <p className="mt-3 text-white/75">{next.body}</p>
            </div>
            <Link
              href={next.href}
              data-magnetic
              className="shrink-0 rounded-full bg-[var(--yellow)] px-7 py-3 text-center text-base font-bold text-[var(--ink)] transition-transform hover:-translate-y-1"
            >
              {next.cta} →
            </Link>
          </div>
        </section>

        {/* Tiles */}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Where to go">
          {tiles.map((t, i) => (
            <Tile key={t.href} {...t} delay={`${0.9 + i * 0.07}s`} />
          ))}
        </ul>

        {/* Path + how it works */}
        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <section aria-labelledby="path-h" className="reveal">
            <h2 id="path-h" className="text-3xl font-black uppercase leading-none tracking-tight">
              Your path
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {doneCount} of {steps.length} done
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[var(--ink)] transition-[width] duration-1000" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <ol className="mt-5 space-y-3">
              {steps.map((s, i) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white">
                    <span
                      className={`check-pop grid size-7 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${
                        s.done ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--ink)]/25 text-[var(--muted)]"
                      }`}
                      style={{ "--d": `${1.4 + i * 0.1}s` } as React.CSSProperties}
                    >
                      {s.done ? "✓" : i + 1}
                    </span>
                    <span className={s.done ? "text-[var(--muted)] line-through" : "font-medium"}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="how-h" className="reveal" style={{ "--d": "0.12s" } as React.CSSProperties}>
            <h2 id="how-h" className="text-3xl font-black uppercase leading-none tracking-tight">
              How SETU works
            </h2>
            <ul className="mt-5 divide-y divide-[var(--ink)]/10">
              {HOW.map((h) => (
                <li key={h.n} className="flex gap-4 py-4">
                  <span className="text-3xl font-black leading-none text-[var(--ink)]/25">{h.n}</span>
                  <div>
                    <h3 className="font-bold">{h.title}</h3>
                    <p className="mt-1 text-[var(--muted)]">{h.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
