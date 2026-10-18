"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseExpertise } from "@/lib/validation/profile";
import { OPP_KINDS, OPP_LABELS, type OppKind } from "@/lib/validation/opportunities";

const control =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";

export function NewOpportunityForm() {
  const router = useRouter();
  const [f, setF] = useState({ kind: "job" as OppKind, title: "", description: "", company: "", skills: "", mode: "", location: "", deadline: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: f.kind,
          title: f.title,
          description: f.description,
          company: f.company || undefined,
          skills: parseExpertise(f.skills),
          mode: f.mode || undefined,
          location: f.location || undefined,
          deadline: f.deadline || undefined,
        }),
      });
      if (res.ok) {
        router.push("/opportunities/mine");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "We could not publish that.");
    } catch {
      setError("Could not reach SETU. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const label = "mb-1 block text-sm font-medium";
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4" noValidate>
      <div>
        <label htmlFor="kind" className={label}>Type</label>
        <select id="kind" className={control} value={f.kind} onChange={(e) => set("kind", e.target.value)}>
          {OPP_KINDS.map((k) => <option key={k} value={k}>{OPP_LABELS[k]}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="title" className={label}>Title</label>
        <input id="title" className={control} maxLength={120} required value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Backend intern, Node and SQL" />
      </div>
      <div>
        <label htmlFor="desc" className={label}>What is it?</label>
        <textarea id="desc" className={control} rows={6} maxLength={2000} required value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="company" className={label}>Company (optional)</label>
          <input id="company" className={control} maxLength={120} value={f.company} onChange={(e) => set("company", e.target.value)} />
        </div>
        <div>
          <label htmlFor="location" className={label}>Location (optional)</label>
          <input id="location" className={control} maxLength={120} value={f.location} onChange={(e) => set("location", e.target.value)} />
        </div>
        <div>
          <label htmlFor="mode" className={label}>Mode</label>
          <select id="mode" className={control} value={f.mode} onChange={(e) => set("mode", e.target.value)}>
            <option value="">Not specified</option>
            <option value="onsite">On site</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
        <div>
          <label htmlFor="deadline" className={label}>Apply by (optional)</label>
          <input id="deadline" type="date" className={control} value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="skills" className={label}>Skills wanted (comma separated)</label>
        <input id="skills" className={control} value={f.skills} onChange={(e) => set("skills", e.target.value)} placeholder="react, sql, communication" />
        <p className="mt-1 text-xs text-[var(--muted)]">Students whose skills match see this higher up.</p>
      </div>
      {error && <p role="alert" className="text-sm text-[var(--red)]">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-full bg-[var(--ink)] px-6 py-3 text-base font-semibold text-white disabled:opacity-60">
        {busy ? "Publishing…" : "Publish"}
      </button>
    </form>
  );
}
