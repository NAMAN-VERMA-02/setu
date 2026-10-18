"use client";

import { useState } from "react";
import Link from "next/link";

export type VouchItem = {
  id: string;
  skill: string;
  note: string | null;
  mine: boolean;
  voucher: { id: string; name: string; role: string; company: string | null } | null;
};

const clean = (name: string) => name.replace(/\s*\(.*?\)\s*/g, " ").trim();

/** Who vouched for this student's skills, and a small form for people allowed to add one. */
export function VouchPanel({ studentId, initial, canVouch, demo = false }: { studentId: string; initial: VouchItem[]; canVouch: boolean; demo?: boolean }) {
  const [items, setItems] = useState(initial);
  const [skill, setSkill] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (demo) {
      setItems([{ id: `new-${items.length}`, skill, note: note || null, mine: true, voucher: { id: "me", name: "You", role: "alumni", company: null } }, ...items]);
      setSkill("");
      setNote("");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/vouches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studentId, skill, note }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "We could not save that.");
    const list = await fetch(`/api/vouches?studentId=${studentId}`).then((r) => r.json()).catch(() => null);
    if (list?.vouches) setItems(list.vouches);
    setSkill("");
    setNote("");
  }

  async function remove(id: string) {
    if (!demo) {
      const res = await fetch(`/api/vouches?id=${id}`, { method: "DELETE" });
      if (!res.ok) return setError("We could not remove that.");
    }
    setItems((cur) => cur.filter((v) => v.id !== id));
  }

  return (
    <section aria-labelledby="vouch-h">
      <h2 id="vouch-h" className="mb-3 text-2xl font-black uppercase tracking-tight">
        Vouched by <span className="text-[var(--muted)]">{items.length}</span>
      </h2>

      {items.length === 0 ? (
        <p className="text-[var(--muted)]">No vouches yet. A senior who has seen their work can put their name to a skill.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((v) => (
            <li key={v.id} className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-[var(--sage)] px-3 py-0.5 text-sm font-bold">{v.skill}</span>
                {v.mine && (
                  <button type="button" onClick={() => remove(v.id)} className="text-xs font-semibold text-[var(--muted)] underline">
                    Take back
                  </button>
                )}
              </div>
              {v.note && <p className="mt-2">{v.note}</p>}
              {v.voucher && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  <Link href={`/people/${v.voucher.id}`} className="font-semibold underline">{clean(v.voucher.name)}</Link>
                  {` · ${v.voucher.role}`}
                  {v.voucher.company ? ` at ${v.voucher.company}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canVouch && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <p className="text-sm font-semibold">Vouch for a skill</p>
          <input value={skill} onChange={(e) => setSkill(e.target.value)} maxLength={40} required placeholder="e.g. React, SQL, public speaking" aria-label="Skill" className="w-full rounded-xl border border-black/10 px-3 py-2" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder="What did you see them do? (optional)" aria-label="Note" className="w-full rounded-xl border border-black/10 px-3 py-2" />
          {error && <p role="alert" className="text-sm text-[var(--red-tile)]">{error}</p>}
          <button disabled={busy || skill.trim().length < 2} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Saving…" : "Vouch"}
          </button>
        </form>
      )}
    </section>
  );
}
