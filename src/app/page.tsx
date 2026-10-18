import Link from "next/link";
import { Hero } from "@/components/hero";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";

const STEPS = [
  { n: "01", tone: "var(--blue)", title: "Match on the “then”", text: "Other platforms show where seniors are today. SETU compares you with what they were in your exact semester: marks, backlogs, branch and direction." },
  { n: "02", tone: "var(--yellow)", title: "Reach them through someone they trust", text: "If nobody you can ask is at your target company, a senior who knows people there can pass your question on. Never more than one bridge." },
  { n: "03", tone: "var(--red-tile)", title: "Pay it forward ×3", text: "When you land your role, answer three juniors who stand where you once stood. The network grows itself." },
];

const FACTS = [
  ["First ask", "one question, never a referral"],
  ["Referral", "unlocks after your work is seen"],
  ["Marks", "shown only as ranges, only if you opt in"],
  ["Links", "expire in 7 days, declines are silent"],
];

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <Hero
          eyebrow="Your college’s own alumni network"
          lines={["Their yesterday", "is your", "_tomorrow._"]}
          size="clamp(3rem, 11vw, 9.5rem)"
          lede="SETU matches you to the seniors who were once exactly where you are now, shows the routes they took, and helps you reach them through people they trust."
        />

        <div className="rise -mt-4 mb-16 flex flex-wrap gap-3" style={{ "--d": "1s" } as React.CSSProperties}>
          <Link href="/signup" data-magnetic className="rounded-full bg-[var(--ink)] px-8 py-3.5 text-base font-bold text-white transition-transform hover:-translate-y-1">
            Join SETU →
          </Link>
          <Link href="/login" data-magnetic className="rounded-full border border-[var(--ink)] px-8 py-3.5 text-base font-bold transition-transform hover:-translate-y-1">
            Log in
          </Link>
        </div>

        <ul className="grid gap-4 md:grid-cols-3" aria-label="How SETU works">
          {STEPS.map((s, i) => (
            <li key={s.n} className="reveal tile rounded-[22px] p-6" style={{ background: s.tone, "--d": `${i * 0.12}s` } as React.CSSProperties}>
              <p className="text-5xl font-black leading-none opacity-30">{s.n}</p>
              <h2 className="mt-8 text-2xl font-black uppercase leading-none tracking-tight">{s.title}</h2>
              <p className="mt-3">{s.text}</p>
            </li>
          ))}
        </ul>

        <section aria-labelledby="trust-h" className="reveal mt-16">
          <h2 id="trust-h" className="text-3xl font-black uppercase leading-none tracking-tight">
            Built to be safe to ask
          </h2>
          <dl className="mt-6 grid gap-x-8 sm:grid-cols-2">
            {FACTS.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-[var(--ink)]/10 py-3">
                <dt className="font-bold">{k}</dt>
                <dd className="text-right text-[var(--muted)]">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
