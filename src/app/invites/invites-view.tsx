"use client";

import { useCallback, useEffect, useState } from "react";

type Invite = { id: string; code: string; role: string; note: string | null; expiresAt: string; usedAt: string | null; usedBy: string | null; expired: boolean; mine: boolean };

const control =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";

export function InvitesView() {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState<"recruiter" | "founder">("recruiter");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/invites");
      const json = await res.json();
      if (res.ok) setInvites(json.invites);
      else setError(json.error ?? "Could not load invites.");
    } catch {
      setError("Could not reach SETU. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    // Fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, note }) });
      const json = await res.json();
      if (res.ok) {
        setFresh(json.link);
        setNote("");
        await refresh();
      } else setError(json.error ?? "Could not create the invite.");
    } catch {
      setError("Could not reach SETU. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-10">
      <form onSubmit={create} className="space-y-4 rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <h2 className="text-2xl font-black uppercase tracking-tight">Invite someone</h2>
        <p className="text-sm text-[var(--muted)]">
          Recruiters and founders usually do not have a college email. Vouch for them here: the link works once, for 14 days, and they must still confirm a real inbox.
        </p>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor="inv-role" className="mb-1 block text-sm font-medium">They are a</label>
            <select id="inv-role" className={control} value={role} onChange={(e) => setRole(e.target.value as "recruiter" | "founder")}>
              <option value="recruiter">Recruiter</option>
              <option value="founder">Founder</option>
            </select>
          </div>
          <div>
            <label htmlFor="inv-note" className="mb-1 block text-sm font-medium">Note to yourself (optional)</label>
            <input id="inv-note" className={control} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Priya from Acme, hiring interns" />
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-[var(--red)]">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-full bg-[var(--ink)] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Creating…" : "Create invite link"}
        </button>

        {fresh && (
          <div className="space-y-2 rounded-2xl bg-[var(--yellow)]/40 p-4" role="status">
            <p className="text-sm font-semibold">Send this link to them</p>
            <input readOnly value={fresh} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" className="w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 font-mono text-sm" />
            <button type="button" onClick={() => copy(fresh)} className="rounded-full border border-[var(--ink)] px-4 py-1.5 text-sm font-semibold">
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}
      </form>

      <section aria-labelledby="inv-h">
        <h2 id="inv-h" className="text-2xl font-black uppercase tracking-tight">Your invites</h2>
        {invites === null ? (
          <div className="mt-3 h-24 animate-pulse rounded-[22px] bg-white" role="status" aria-label="Loading" />
        ) : invites.length === 0 ? (
          <p className="mt-3 rounded-[22px] bg-white p-5 text-[var(--muted)]">No invites yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--ink)]/10 rounded-[22px] bg-white px-5">
            {invites.map((i) => {
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold capitalize">{i.role}{i.note ? <span className="ml-2 font-normal normal-case text-[var(--muted)]">{i.note}</span> : null}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">{i.code}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${i.usedAt ? "bg-[var(--sage)]" : i.expired ? "bg-[var(--stone)]" : "bg-[var(--yellow)]"}`}>
                    {i.usedAt ? `Used by ${i.usedBy}` : i.expired ? "Expired" : `Open until ${new Date(i.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
