"use client";

import { useState, useTransition } from "react";
import {
  FOUNDER_STAGES,
  INTENT_CATEGORIES,
  INTENT_LABELS,
  MAX_INTENTS,
  OPEN_TO,
  OPEN_TO_LABELS,
  parseExpertise,
  roleExtras,
  type OpenTo,
  type ProfileActionState,
} from "@/lib/validation/profile";
import { saveProfile } from "./actions";

type IntentRow = { kind: "seek" | "offer"; category: (typeof INTENT_CATEGORIES)[number]; statement: string };

export type InitialProfile = {
  role: string;
  headline: string;
  bio: string;
  location: string;
  currentCompany: string;
  currentTitle: string;
  expertise: string;
  openTo: OpenTo[];
  intents: IntentRow[];
  stage: string;
  problems: string;
  lab: string;
  hiringFocus: string;
};

const control =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function ProfileForm({ initial }: { initial: InitialProfile }) {
  const extras = roleExtras(initial.role);
  const [f, setF] = useState(initial);
  const [result, setResult] = useState<ProfileActionState>({});
  const [saving, start] = useTransition();
  const set = <K extends keyof InitialProfile>(k: K, v: InitialProfile[K]) => setF((s) => ({ ...s, [k]: v }));

  const toggleOpen = (v: OpenTo) =>
    set("openTo", f.openTo.includes(v) ? f.openTo.filter((x) => x !== v) : [...f.openTo, v]);
  const setIntent = (i: number, patch: Partial<IntentRow>) =>
    set("intents", f.intents.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      headline: f.headline,
      bio: f.bio,
      location: f.location,
      currentCompany: f.currentCompany,
      currentTitle: f.currentTitle,
      expertise: parseExpertise(f.expertise),
      openTo: f.openTo,
      intents: f.intents.filter((i) => i.statement.trim().length > 0),
      stage: f.stage || undefined,
      problems: f.problems || undefined,
      lab: f.lab || undefined,
      hiringFocus: f.hiringFocus || undefined,
    };
    start(async () => setResult(await saveProfile(payload)));
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-10" noValidate>
      <section aria-labelledby="about-h" className="space-y-4">
        <h2 id="about-h" className="text-2xl font-black uppercase">About you</h2>
        <Field id="headline" label="Headline" hint="One line others see first, e.g. “SDE at Zoho · happy to talk GATE vs job”.">
          <input id="headline" className={control} maxLength={140} value={f.headline} onChange={(e) => set("headline", e.target.value)} />
        </Field>
        <Field id="bio" label="Short bio">
          <textarea id="bio" className={control} rows={4} maxLength={800} value={f.bio} onChange={(e) => set("bio", e.target.value)} />
        </Field>
        <Field id="location" label="Where are you based?">
          <input id="location" className={control} maxLength={120} value={f.location} onChange={(e) => set("location", e.target.value)} />
        </Field>

        {extras.includes("company") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="company" label="Company">
              <input id="company" className={control} maxLength={120} value={f.currentCompany} onChange={(e) => set("currentCompany", e.target.value)} />
            </Field>
            <Field id="title" label="Job title">
              <input id="title" className={control} maxLength={120} value={f.currentTitle} onChange={(e) => set("currentTitle", e.target.value)} />
            </Field>
          </div>
        )}
        {extras.includes("stage") && (
          <Field id="stage" label="Company stage">
            <select id="stage" className={control} value={f.stage} onChange={(e) => set("stage", e.target.value)}>
              <option value="">Choose a stage</option>
              {FOUNDER_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        )}
        {extras.includes("problems") && (
          <Field id="problems" label="Problems you are solving" hint="Students use this to see if they can help.">
            <textarea id="problems" className={control} rows={3} maxLength={400} value={f.problems} onChange={(e) => set("problems", e.target.value)} />
          </Field>
        )}
        {extras.includes("lab") && (
          <Field id="lab" label="Lab or department">
            <input id="lab" className={control} maxLength={200} value={f.lab} onChange={(e) => set("lab", e.target.value)} />
          </Field>
        )}
        {extras.includes("hiringFocus") && (
          <Field id="hiring" label="Who are you hiring?">
            <textarea id="hiring" className={control} rows={3} maxLength={300} value={f.hiringFocus} onChange={(e) => set("hiringFocus", e.target.value)} />
          </Field>
        )}
      </section>

      <section aria-labelledby="exp-h" className="space-y-4">
        <h2 id="exp-h" className="text-2xl font-black uppercase">
          {initial.role === "faculty" ? "Research areas" : "Expertise"}
        </h2>
        <Field id="expertise" label="Skills and topics (comma separated)" hint="People search matches on these.">
          <input id="expertise" className={control} value={f.expertise} onChange={(e) => set("expertise", e.target.value)} placeholder="React, SQL, GATE prep, interview coaching" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">I am open to</legend>
          <div className="flex flex-wrap gap-2">
            {OPEN_TO.map((v) => (
              <label key={v} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium ${f.openTo.includes(v) ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--ink)]/25 bg-white"}`}>
                <input type="checkbox" className="sr-only" checked={f.openTo.includes(v)} onChange={() => toggleOpen(v)} />
                {OPEN_TO_LABELS[v]}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="int-h" className="space-y-4">
        <h2 id="int-h" className="text-2xl font-black uppercase">Intent</h2>
        <p className="text-sm text-[var(--muted)]">What are you looking for, and what can you offer? Others find you by this.</p>
        {f.intents.map((row, i) => (
          <div key={i} className="grid gap-2 rounded-2xl bg-white p-3 sm:grid-cols-[8rem_9rem_1fr_auto]">
            <select aria-label="Looking for or offering" className={control} value={row.kind} onChange={(e) => setIntent(i, { kind: e.target.value as IntentRow["kind"] })}>
              <option value="seek">Looking for</option>
              <option value="offer">Offering</option>
            </select>
            <select aria-label="Category" className={control} value={row.category} onChange={(e) => setIntent(i, { category: e.target.value as IntentRow["category"] })}>
              {INTENT_CATEGORIES.map((c) => <option key={c} value={c}>{INTENT_LABELS[c]}</option>)}
            </select>
            <input aria-label="Statement" className={control} maxLength={200} value={row.statement} onChange={(e) => setIntent(i, { statement: e.target.value })} placeholder={row.kind === "seek" ? "SDE at Cognizant" : "GATE mentoring for CSE juniors"} />
            <button type="button" onClick={() => set("intents", f.intents.filter((_, idx) => idx !== i))} className="rounded-full border border-[var(--ink)] px-4 py-2 text-sm font-semibold" aria-label="Remove this intent">
              Remove
            </button>
          </div>
        ))}
        {f.intents.length < MAX_INTENTS && (
          <button type="button" onClick={() => set("intents", [...f.intents, { kind: "seek", category: "career", statement: "" }])} className="rounded-full border border-[var(--ink)] px-5 py-2 text-sm font-semibold">
            + Add an intent
          </button>
        )}
      </section>

      {result.errors && (
        <ul role="alert" className="list-disc pl-5 text-sm text-[var(--red)]">
          {result.errors.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
      {result.message && (
        <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-sm font-medium" : "text-sm text-[var(--red)]"}>
          {result.message}
        </p>
      )}
      <button type="submit" disabled={saving} className="w-full rounded-full bg-[var(--ink)] px-6 py-3 text-base font-semibold text-white disabled:opacity-60">
        {saving ? "Saving…" : "Save my profile"}
      </button>
    </form>
  );
}
