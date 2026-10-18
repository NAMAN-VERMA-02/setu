import Link from "next/link";
import { Hero } from "@/components/hero";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <Hero
          eyebrow="Error 404"
          lines={["Lost?", "_this_ page", "never happened."]}
          size="clamp(3rem, 10vw, 8.5rem)"
          lede="Their yesterday is your tomorrow, but this link is neither. Head back and pick up where you left off."
        />
        <div className="rise flex flex-wrap gap-3" style={{ "--d": "1s" } as React.CSSProperties}>
          <Link href="/dashboard" data-magnetic className="rounded-full bg-[var(--ink)] px-8 py-3.5 text-base font-bold text-white">
            Go to your dashboard →
          </Link>
          <Link href="/" data-magnetic className="rounded-full border border-[var(--ink)] px-8 py-3.5 text-base font-bold">
            Home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
