"use client";

import { useState, useTransition } from "react";
import type { JourneyDraft } from "@/lib/llm/journey";
import {
  CGPA_BUCKETS,
  DECISIONS,
  DECISION_LABELS,
  MAX_SEMESTERS,
  PERCENT_BUCKETS,
  parseSkills,
  type JourneyActionState,
  type JourneyInput,
} from "@/lib/validation/journey";
import { saveJourney } from "./actions";

type Row = {
  cgpaRange: string;
  backlogCount: string;
  skills: string;
  status: string;
  decision: string;
  showCgpa: boolean;
};

export type InitialJourney = {
  goalTarget: string;
  goalCompany: string;
  goalQuestion: string;
  tenthRange: string;
  twelfthRange: string;
  showTenth: boolean;
  showTwelfth: boolean;
  rows: Record<number, Row>;
  currentSemester: number;
};

const emptyRow = (): Row => ({
  cgpaRange: "",
  backlogCount: "0",
  skills: "",
  status: "",
  decision: "",
  showCgpa: false,
});

const control =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
      {children}
    </label>
  );
}

export function JourneyForm({ initial }: { initial: InitialJourney }) {
  const [goalTarget, setGoalTarget] = useState(initial.goalTarget);
  const [goalCompany, setGoalCompany] = useState(initial.goalCompany);
  const [goalQuestion, setGoalQuestion] = useState(initial.goalQuestion);
  const [tenthRange, setTenthRange] = useState(initial.tenthRange);
  const [twelfthRange, setTwelfthRange] = useState(initial.twelfthRange);
  const [showTenth, setShowTenth] = useState(initial.showTenth);
  const [showTwelfth, setShowTwelfth] = useState(initial.showTwelfth);
  const [current, setCurrent] = useState(initial.currentSemester);
  const [rows, setRows] = useState<Record<number, Row>>(initial.rows);

  const [result, setResult] = useState<JourneyActionState>({});
  const [saving, startSaving] = useTransition();

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [timeline, setTimeline] = useState<JourneyDraft["timeline"]>([]);

  const semesters = Array.from({ length: current }, (_, i) => i + 1);
  const rowFor = (n: number) => rows[n] ?? emptyRow();
  const setRow = (n: number, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [n]: { ...(r[n] ?? emptyRow()), ...patch } }));

  async function importPdf(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setImportError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/parse-journey", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setImportError(json.error ?? "Import failed. Fill the form by hand instead.");
        return;
      }
      const draft: JourneyDraft = json.draft;
      setTimeline(draft.timeline);
      // Fill only empty fields so nothing the user typed is overwritten.
      setRows((prev) => {
        const next = { ...prev };
        for (const s of draft.semesters) {
          if (s.semester > current) continue;
          const row = next[s.semester] ?? emptyRow();
          next[s.semester] = {
            ...row,
            skills: row.skills || s.skills.join(", "),
            status: row.status || s.status,
            decision: row.decision || (s.decision ?? ""),
          };
        }
        return next;
      });
    } catch {
      setImportError("Import failed. Fill the form by hand instead.");
    } finally {
      setImporting(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      goalTarget,
      goalCompany,
      goalQuestion,
      tenthRange: tenthRange || null,
      twelfthRange: twelfthRange || null,
      showTenth,
      showTwelfth,
      snapshots: semesters.map((n) => {
        const r = rowFor(n);
        return {
          semester: n,
          cgpaRange: r.cgpaRange || null,
          backlogCount: Number(r.backlogCount) || 0,
          skills: parseSkills(r.skills),
          status: r.status,
          decision: r.decision || null,
          showCgpa: r.showCgpa,
        };
      }),
    } as unknown as JourneyInput;
    startSaving(async () => setResult(await saveJourney(payload)));
  }

  return (
    <form onSubmit={submit} className="space-y-10" noValidate>
      <section aria-labelledby="goal-h" className="space-y-4">
        <h2 id="goal-h" className="text-2xl font-black uppercase">Your goal</h2>
        <div>
          <Label htmlFor="goalTarget">What are you aiming for?</Label>
          <input id="goalTarget" className={control} value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="SDE at Cognizant" maxLength={200} required />
        </div>
        <div>
          <Label htmlFor="goalCompany">Target company (optional)</Label>
          <input id="goalCompany" className={control} value={goalCompany} onChange={(e) => setGoalCompany(e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label htmlFor="goalQuestion">One question you would like a senior to answer (optional)</Label>
          <input id="goalQuestion" className={control} value={goalQuestion} onChange={(e) => setGoalQuestion(e.target.value)} maxLength={300} placeholder="How did you prepare for the online test?" />
          <p className="mt-1 text-xs text-[var(--muted)]">Seniors who have just landed a job are asked to answer one question from three juniors like you.</p>
        </div>
      </section>

      <section aria-labelledby="import-h" className="space-y-3 rounded-2xl bg-white p-4">
        <h2 id="import-h" className="text-lg font-bold">Import from LinkedIn (optional)</h2>
        <p className="text-sm text-[var(--muted)]">
          Upload the PDF from LinkedIn&apos;s &ldquo;Save to PDF&rdquo;. We read it once to suggest skills and
          activity per semester, and we do not store the file. Review everything before saving.
        </p>
        <input
          type="file"
          accept="application/pdf"
          disabled={importing}
          onChange={(e) => importPdf(e.target.files?.[0])}
          aria-label="LinkedIn PDF"
        />
        {importing && <p role="status" className="text-sm">Reading your PDF…</p>}
        {importError && <p role="alert" className="text-sm text-[var(--red)]">{importError}</p>}
        {timeline.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {timeline.map((t, i) => (
              <li key={i}>
                <span className="font-semibold">{t.semester ? `Sem ${t.semester}` : "Other"}:</span> {t.title}
                {t.organization ? ` · ${t.organization}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="school-h" className="space-y-4">
        <h2 id="school-h" className="text-2xl font-black uppercase">School marks</h2>
        <p className="text-sm text-[var(--muted)]">Stored as ranges. Others see a range only if you switch it on.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tenth">10th marks (%)</Label>
            <select id="tenth" className={control} value={tenthRange} onChange={(e) => setTenthRange(e.target.value)}>
              <option value="">Prefer not to say</option>
              {PERCENT_BUCKETS.map((b) => <option key={b} value={b}>{b}%</option>)}
            </select>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showTenth} onChange={(e) => setShowTenth(e.target.checked)} /> Show to others
            </label>
          </div>
          <div>
            <Label htmlFor="twelfth">12th marks (%)</Label>
            <select id="twelfth" className={control} value={twelfthRange} onChange={(e) => setTwelfthRange(e.target.value)}>
              <option value="">Prefer not to say</option>
              {PERCENT_BUCKETS.map((b) => <option key={b} value={b}>{b}%</option>)}
            </select>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showTwelfth} onChange={(e) => setShowTwelfth(e.target.checked)} /> Show to others
            </label>
          </div>
        </div>
      </section>

      <section aria-labelledby="sem-h" className="space-y-6">
        <h2 id="sem-h" className="text-2xl font-black uppercase">Semester by semester</h2>
        <div className="max-w-xs">
          <Label htmlFor="current">Which semester are you in (or finished)?</Label>
          <select id="current" className={control} value={current} onChange={(e) => setCurrent(Number(e.target.value))}>
            {Array.from({ length: MAX_SEMESTERS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Semester {n}</option>)}
          </select>
        </div>

        {semesters.map((n) => {
          const r = rowFor(n);
          return (
            <fieldset key={n} className="space-y-4 rounded-2xl border border-[var(--ink)]/15 bg-white p-4">
              <legend className="px-2 text-lg font-bold">Semester {n}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`cgpa-${n}`}>CGPA</Label>
                  <select id={`cgpa-${n}`} className={control} value={r.cgpaRange} onChange={(e) => setRow(n, { cgpaRange: e.target.value })}>
                    <option value="">Prefer not to say</option>
                    {CGPA_BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={r.showCgpa} onChange={(e) => setRow(n, { showCgpa: e.target.checked })} /> Show to others
                  </label>
                </div>
                <div>
                  <Label htmlFor={`backlogs-${n}`}>Backlogs</Label>
                  <input id={`backlogs-${n}`} type="number" min={0} max={50} className={control} value={r.backlogCount} onChange={(e) => setRow(n, { backlogCount: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor={`skills-${n}`}>Skills (comma separated)</Label>
                <input id={`skills-${n}`} className={control} value={r.skills} onChange={(e) => setRow(n, { skills: e.target.value })} placeholder="React, SQL, DSA" />
              </div>
              <div>
                <Label htmlFor={`status-${n}`}>What were you doing?</Label>
                <input id={`status-${n}`} className={control} value={r.status} onChange={(e) => setRow(n, { status: e.target.value })} maxLength={200} placeholder="Preparing for placements, one backlog in DBMS" />
              </div>
              <div>
                <Label htmlFor={`decision-${n}`}>Where were you heading?</Label>
                <select id={`decision-${n}`} className={control} value={r.decision} onChange={(e) => setRow(n, { decision: e.target.value })}>
                  <option value="">Not decided</option>
                  {DECISIONS.map((d) => <option key={d} value={d}>{DECISION_LABELS[d]}</option>)}
                </select>
              </div>
            </fieldset>
          );
        })}
      </section>

      {result.errors && (
        <ul role="alert" className="list-disc pl-5 text-sm text-[var(--red)]">
          {result.errors.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
      {result.message && (
        <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm" : "text-sm text-[var(--red)]"}>
          {result.message}
        </p>
      )}

      <button type="submit" disabled={saving} className="w-full rounded-full bg-[var(--ink)] px-6 py-3 text-base font-semibold text-white disabled:opacity-60">
        {saving ? "Saving…" : "Save my journey"}
      </button>
    </form>
  );
}
