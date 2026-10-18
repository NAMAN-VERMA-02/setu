"use client";

import { useMemo, useState } from "react";
import { inviteMessage, parseAlumniCsv, type ImportRow } from "@/lib/college/csv";

export type ImportedPerson = { id: string; fullName: string; batch: number; branch: string; email: string | null; joined: boolean };

type Props = {
  people: ImportedPerson[];
  loading?: boolean;
  siteUrl: string;
  onImport: (rows: ImportRow[]) => Promise<{ error?: string; added?: number; skipped?: number }>;
};

const SAMPLE = "name,batch,branch,email\nAsha Rao,2019,CSE,asha@example.com\nVikram Das,2021,ECE,vikram@example.com";

/** Paste or upload an alumni list, check it, import it, and see who has joined. */
export function ImportBoard({ people, loading, siteUrl, onImport }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting" | "joined">("all");

  const parsed = useMemo(() => (text.trim() ? parseAlumniCsv(text) : null), [text]);
  const joined = people.filter((p) => p.joined).length;
  const shown = people.filter((p) => (filter === "all" ? true : filter === "joined" ? p.joined : !p.joined));

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 500_000) return setError("That file is too large. Keep it under 500 KB.");
    setError(null);
    setText(await file.text());
  }

  async function submit() {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const out = await onImport(parsed.rows);
    setBusy(false);
    if (out.error) return setError(out.error);
    setDone(`Added ${out.added}${out.skipped ? `, skipped ${out.skipped} already on the list` : ""}.`);
    setText("");
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="imp-h" className="rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)] sm:p-8">
        <h2 id="imp-h" className="text-2xl font-black uppercase tracking-tight">Add your alumni list</h2>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          One person per line with the columns <code>name</code>, <code>batch</code>, <code>branch</code> and optionally <code>email</code>. Up to 500 at a time. Nobody is emailed from here.
        </p>
        <label htmlFor="csv" className="sr-only">Alumni list as CSV</label>
        <textarea id="csv" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={SAMPLE} className="w-full rounded-2xl border border-black/10 px-4 py-3 font-mono text-sm" />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-full border border-[var(--ink)] px-5 py-2 text-sm font-semibold hover:bg-[var(--ink)] hover:text-white">
            Choose a CSV file
            <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />
          </label>
          <button type="button" onClick={submit} disabled={busy || !parsed || parsed.rows.length === 0} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Importing…" : parsed && parsed.rows.length > 0 ? `Import ${parsed.rows.length} ${parsed.rows.length === 1 ? "person" : "people"}` : "Import"}
          </button>
        </div>

        {parsed && parsed.problems.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 rounded-2xl bg-[var(--yellow)]/40 p-4 text-sm">
            {parsed.problems.slice(0, 8).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {parsed.problems.length > 8 && <li>…and {parsed.problems.length - 8} more.</li>}
          </ul>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-[var(--red-tile)]">{error}</p>}
        {done && <p role="status" className="mt-4 text-sm font-semibold">{done}</p>}
      </section>

      <section aria-labelledby="list-h">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="list-h" className="text-2xl font-black uppercase tracking-tight">
            Your list <span className="text-[var(--muted)]">{joined} of {people.length} joined</span>
          </h2>
          <div className="flex gap-1" role="group" aria-label="Filter">
            {(["all", "waiting", "joined"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize ${filter === f ? "bg-[var(--ink)] text-white" : "bg-white shadow-[0_0_0_1px_rgba(15,15,14,.08)]"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-[var(--muted)]">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-[var(--muted)]">{people.length === 0 ? "Nobody yet. Add your first list above." : "Nobody in this view."}</p>
        ) : (
          <ul className="divide-y divide-black/5 rounded-[22px] bg-white shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
            {shown.map((p) => {
              const m = inviteMessage(p.fullName, siteUrl);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.fullName}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{p.branch} · batch {p.batch}{p.email ? ` · ${p.email}` : ""}</p>
                  </div>
                  {p.joined ? (
                    <span className="rounded-full bg-[var(--sage)] px-3 py-1 text-xs font-bold uppercase">Joined</span>
                  ) : p.email ? (
                    <a href={`mailto:${p.email}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`} className="rounded-full border border-[var(--ink)] px-4 py-1.5 text-sm font-semibold hover:bg-[var(--ink)] hover:text-white">
                      Write invite
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">No email</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
