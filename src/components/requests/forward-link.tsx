"use client";

import { useState } from "react";

/**
 * Shown once, right after the bridging senior creates a forward link. Only the link's
 * hash is stored, so closing this panel means it cannot be shown again.
 */
export function ForwardLink({
  link,
  company,
  expiresAt,
  onDone,
}: {
  link: string;
  company: string | null;
  expiresAt?: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `Hi! A student from our college is looking for advice${company ? ` about ${company}` : ""}. You can see their request and reply in one tap, no sign-up needed: ${link}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(text)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl bg-[var(--yellow)]/40 p-4" role="region" aria-label="Forward link">
      <p className="text-sm font-semibold">Send this to the person you have in mind</p>
      <p className="text-sm">
        Share it from your own phone. They can read the request and reply in one tap without signing up. You choose who
        gets it, and SETU never learns who that is unless they reply.
      </p>

      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Forward link"
        className="w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 font-mono text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white">
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[var(--ink)] px-5 py-2 text-sm font-semibold"
        >
          Share on WhatsApp
        </a>
      </div>

      <p className="text-xs text-[var(--muted)]">
        {expiresAt ? `The link works until ${new Date(expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}. ` : "The link works for 7 days. "}
        This is the only time it is shown.
      </p>
      <button type="button" onClick={onDone} className="text-sm font-semibold underline">
        I have copied it
      </button>
    </div>
  );
}
