"use client";

import Link from "next/link";
import { useState } from "react";
import { api, COLLEGE_COLOUR } from "@/lib/fed/client";

type Trace = { node: string; tool: string; args: Record<string, unknown>; ms: number; identifyingFields: number; ok: boolean; error?: string };
type Card = { pid: string; node: string; label: string; score: number | null };
type Answer = { answer: string; trace: Trace[]; cards: Card[]; mode: "ai" | "offline"; offline: string[] };

const SAMPLES = ["NGIT ke kaunse alumni fintech ML mein madad kar sakte hain?", "Any ECE seniors who ended up in a product company?", "How many alumni does each college have?"];

/** Chat on the left, live MCP trace on the right: every call to a college's server, with its identifying-field count. */
export function AskView() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [shown, setShown] = useState(0);

  async function submit(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    setA(null);
    setShown(0);
    const r = await api<Answer & { error?: string }>("/api/fed/ask", { method: "POST", json: { question: text } });
    setBusy(false);
    if (!r.ok) return setError(r.data.error ?? "Could not answer that.");
    setA(r.data);
    // reveal the trace one call at a time so the room can follow it
    r.data.trace.forEach((_, i) => setTimeout(() => setShown(i + 1), 350 * (i + 1)));
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">Ask Setu · over MCP</p>
        <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">Ask the colleges.</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(q);
            }}
            className="flex gap-3"
          >
            <label className="sr-only" htmlFor="q">
              Your question
            </label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask in English or Hinglish" className="min-w-0 flex-1 rounded-full border border-[var(--ink)]/25 bg-[var(--paper)] px-6 py-3 text-lg" />
            <button disabled={busy} className="rounded-full bg-[var(--ink)] px-7 py-3 text-lg font-semibold text-white disabled:opacity-60">
              {busy ? "Asking…" : "Ask"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <button key={s} type="button" onClick={() => (setQ(s), void submit(s))} className="rounded-full border border-[var(--ink)]/25 px-4 py-2 text-left text-base">
                {s}
              </button>
            ))}
          </div>

          {error && <p role="alert" className="mt-4 text-[var(--red)]">{error}</p>}
          {busy && <div className="mt-5 h-32 animate-pulse rounded-xl bg-[var(--paper)]" role="status" aria-label="Asking the colleges" />}

          {a && (
            <div className="mt-5 space-y-4" aria-live="polite">
              <p className="whitespace-pre-line text-xl leading-relaxed">{a.answer}</p>
              {a.mode === "offline" && <p className="text-base font-semibold text-[var(--muted)]">Offline mode: answered with keyword routing over the same tools.</p>}
              <ul className="grid gap-3">
                {a.cards.slice(0, 6).map((c) => (
                  <li key={c.pid} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--paper)] p-4" style={{ borderLeft: `6px solid ${COLLEGE_COLOUR[c.node]}` }}>
                    <span className="text-lg font-bold">{c.label}</span>
                    <Link href={`/live/bridge?target=${c.pid}`} className="rounded-full bg-[var(--ink)] px-5 py-2 text-base font-semibold text-white">
                      Ask for intro
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-[22px] bg-[var(--ink)] p-6 text-white" aria-label="MCP trace">
          <h2 className="text-2xl font-black">MCP trace</h2>
          <p className="text-base opacity-70">Every call goes to a college’s own server.</p>
          <ol className="mt-4 space-y-3 font-mono text-base">
            {!a && !busy && <li className="opacity-60">Waiting for a question…</li>}
            {a?.trace.slice(0, shown).map((t, i) => (
              <li key={i} className="rounded-xl bg-white/10 p-3">
                <span className="font-bold" style={{ color: t.node === "ngit" ? "#93c5fd" : "#fcd34d" }}>
                  → {t.node.toUpperCase()} server
                </span>{" "}
                · {t.tool} · {t.ms} ms
                <br />
                <span className={t.ok ? "text-[#86efac]" : "text-[#fca5a5]"}>{t.ok ? `${t.identifyingFields} identifying fields` : (t.error ?? "failed")}</span>
              </li>
            ))}
          </ol>
          {a && a.offline.length > 0 && <p className="mt-4 text-base">{a.offline.map((n) => n.toUpperCase()).join(", ")} is offline: no calls were made to it.</p>}
        </section>
      </div>
    </div>
  );
}
