import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";

const POINTS = [
  "Matched to seniors who stood exactly where you stand",
  "Introduced through someone they already trust",
  "Marks shown only as ranges, only if you switch them on",
];

/** Shared frame for log in and sign up: story on the left, form card on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-16 lg:pt-16">
        <section aria-label="About SETU" className="hidden lg:block">
          <p className="rise mb-5 inline-block rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-[0_0_0_1px_rgba(15,15,14,.08)]" style={{ "--d": "0.15s" } as React.CSSProperties}>
            Your college’s own network
          </p>
          <p className="text-[clamp(3rem,6.2vw,6rem)] font-black uppercase leading-[0.88] tracking-[-0.04em]" aria-hidden="true">
            {["Their yesterday", "is your", "_tomorrow._"].map((line, i) => (
              <span key={line} className="mask-line" style={{ "--d": `${0.2 + i * 0.12}s` } as React.CSSProperties}>
                <span>
                  {line.startsWith("_") ? <span className="accent">{line.slice(1, -1)}</span> : line}
                </span>
              </span>
            ))}
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p, i) => (
              <li key={p} className="rise flex items-start gap-3 text-lg" style={{ "--d": `${0.7 + i * 0.12}s` } as React.CSSProperties}>
                <span className="mt-1 text-[var(--red-tile)]" aria-hidden="true">
                  ✦
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>

        <div className="rise" style={{ "--d": "0.4s" } as React.CSSProperties}>
          <div className="rounded-[22px] bg-white p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08),0_30px_60px_-40px_rgba(15,15,14,.35)] sm:p-8">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
