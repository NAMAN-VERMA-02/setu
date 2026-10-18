import Link from "next/link";
import { pct, type CollegeStats } from "@/lib/college/stats";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <li className="rounded-[22px] p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]" style={{ background: tone }}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-2 text-5xl font-black leading-none tracking-tight">{value}</p>
      {sub && <p className="mt-2 text-sm text-[var(--ink)]/70">{sub}</p>}
    </li>
  );
}

const LADDER_LABELS: { key: keyof CollegeStats["ladder"]; label: string }[] = [
  { key: "question", label: "Asked a question" },
  { key: "call", label: "Reached a 15-minute call" },
  { key: "task", label: "Did a small task" },
  { key: "referral", label: "Unlocked a referral" },
];

/** Engagement and outcomes for the placement cell. Every figure is a count or a percentage. */
export function CollegeDashboard({ stats }: { stats: CollegeStats }) {
  const asks = stats.ladder.question;
  const roles = Object.entries(stats.members).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-10">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Headline figures">
        <Tile label="Students on SETU" value={String(stats.students)} sub={`${pct(stats.journeys_shared, stats.students)}% have shared their journey`} tone="white" />
        <Tile label="Got a first reply" value={`${pct(stats.students_replied, stats.students_asked)}%`} sub={`${stats.students_replied} of ${stats.students_asked} students who asked`} tone="var(--blue)" />
        <Tile label="Landed a role" value={String(stats.placed)} sub="members who shared a success" tone="var(--yellow)" />
        <Tile label="Paid forward" value={String(stats.helps)} sub={`answers from ${stats.helpers} seniors · ${stats.help_owed_open} still owed`} tone="var(--sage)" />
      </ul>

      {stats.network && (
        <section aria-labelledby="net-h" className="reveal rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)] sm:p-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="net-h" className="text-2xl font-black uppercase tracking-tight">The network at work</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Opportunities, connections and conversations across your college.</p>
            </div>
            <div className="flex gap-2 text-sm font-semibold">
              <Link href="/college/import" className="rounded-full border border-[var(--ink)] px-4 py-1.5 hover:bg-[var(--ink)] hover:text-white">Import alumni</Link>
              <Link href="/announcements" className="rounded-full border border-[var(--ink)] px-4 py-1.5 hover:bg-[var(--ink)] hover:text-white">Post an announcement</Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Open opportunities", `${stats.network.opportunities_open}`, `${stats.network.opportunities_total} posted in all`],
              ["Applications", `${stats.network.applications}`, "people showed interest"],
              ["Connections", `${stats.network.connections}`, "accepted across the college"],
              ["Vouches", `${stats.network.vouches}`, "seniors backing a skill"],
              ["Conversations", `${stats.network.conversations}`, `${stats.network.messages_7d} messages this week`],
              ["Alumni imported", `${stats.network.imported}`, `${stats.network.imported_joined} have joined`],
            ].map(([label, value, sub]) => (
              <div key={label}>
                <dt className="text-sm font-medium">{label}</dt>
                <dd className="text-4xl font-black leading-tight tracking-tight">{value}</dd>
                <dd className="text-xs text-[var(--muted)]">{sub}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="ladder-h" className="reveal rounded-[22px] bg-white p-5 sm:p-8 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <h2 id="ladder-h" className="text-2xl font-black uppercase tracking-tight">Climbing the trust ladder</h2>
        <p className="mb-5 mt-1 text-sm text-[var(--muted)]">
          How far {asks} requests got: a question, then a call, a small task, and only then a referral.
        </p>
        <ol className="space-y-3">
          {LADDER_LABELS.map(({ key, label }) => {
            const n = stats.ladder[key];
            return (
              <li key={key}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{label}</span>
                  <span>
                    {n} <span className="text-[var(--muted)]">({pct(n, asks)}%)</span>
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--paper)]" role="img" aria-label={`${pct(n, asks)} percent`}>
                  <div className="h-full rounded-full bg-[var(--ink)]" style={{ width: `${pct(n, asks)}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="co-h" className="reveal rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <h2 id="co-h" className="text-xl font-black uppercase tracking-tight">Where members landed</h2>
          {stats.top_companies.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Companies appear once at least two members have landed there.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--ink)]/10">
              {stats.top_companies.map((c) => (
                <li key={c.company} className="flex justify-between py-2 text-sm">
                  <span>{c.company}</span>
                  <span className="font-semibold">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="mem-h" className="reveal rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <h2 id="mem-h" className="text-xl font-black uppercase tracking-tight">Who is on SETU</h2>
          <ul className="mt-3 divide-y divide-[var(--ink)]/10">
            {roles.map(([role, n]) => (
              <li key={role} className="flex justify-between py-2 text-sm">
                <span className="capitalize">{role}</span>
                <span className="font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
