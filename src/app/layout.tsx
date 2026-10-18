import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { CursorFx } from "@/components/fx/cursor-fx";
import { INTRO_SCRIPT } from "@/components/fx/intro-script";
import { THEME_SCRIPT } from "@/components/fx/theme-script";
import { Preloader } from "@/components/fx/preloader";
import { ScrollReveal } from "@/components/fx/scroll-reveal";
import "./globals.css";
import "./motion.css";
import "./theme.css";
import "./ambient.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Italic serif used for single accent words inside big sans headlines.
const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "SETU — their yesterday is your tomorrow",
  description: "A college alumni network that matches you to seniors who were once where you are.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT + THEME_SCRIPT }} />
      </head>
      <body id="top" className="min-h-full flex flex-col">
        <Preloader />
        {children}
        <ScrollReveal />
        <CursorFx />
      </body>
    </html>
  );
}
