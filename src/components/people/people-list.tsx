"use client";

import Link from "next/link";
import type { PersonCard } from "@/lib/people/types";
import { OPEN_TO, OPEN_TO_LABELS, type OpenTo } from "@/lib/validation/profile";

const ROLE_FILTERS = [
  ["", "Everyone"],
  ["student", "Students"],
  ["alumni", "Alumni"],
  ["faculty", "Faculty"],
  ["founder", "Founders"],
  ["recruiter", "Recruiters"],
  ["placement", "Placement cell"],
] as const;

const ROLE_TONE: Record<string, string> = {
  student: "var(--blue)",
  alumni: "var(--yellow)",
  faculty: "var(--sage)",
  founder: "var(--red-tile)",
  recruiter: "var(--stone)",
  placement: "var(--stone)",
};

const control =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";

function Person({ p, action }: { p: PersonCard; action?: (p: PersonCard) => React.ReactNode }) {
  return (
    <li className="reveal rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-black uppercase leading-tight tracking-tight">
            <Link href={`/people/${p.id}`} className="underline-offset-4 hover:underline">
              {p.name}
            </Link>
          </h3>
          <p className="text-sm text-[var(--muted)]">
            {p.headline || [p.title, p.company].filter(Boolean).join(" at ") || `${p.branch} · batch ${p.batch}`}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide" style={{ background: ROLE_TONE[p.role] ?? "var(--stone)" }}>
          {p.role}
        </span>
      </div>

      {p.expertise.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Expertise">
          {p.expertise.map((e) => (
            <li key={e} className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-medium">
              {e}
            </li>
          ))}
        </ul>
      )}

      {p.intents.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" aria-label="Intent">
          {p.intents.map((i, idx) => (
            <li key={idx}>
              <span className="font-semibold">{i.kind === "offer" ? "Offers" : "Looking for"}:</span> {i.statement}
            </li>
          ))}
        </ul>
      )}

      {p.reasons.length > 0 && (
        <ul className="mt-4 space-y-1 border-l-4 border-[var(--yellow)] pl-3 text-sm" aria-label="Why this person">
          {p.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {action && <div className="mt-4">{action(p)}</div>}
    </li>
  );
}

/** Presentational people search: an intent box, role and open-to filters, and ranked results. */
export function PeopleList({
  people,
  loading,
  q,
  role,
  openTo,
  onQuery,
  onRole,
  onOpenTo,
  action,
}: {
  people: PersonCard[];
  loading: boolean;
  q: string;
  role: string;
  openTo: string;
  onQuery: (v: string) => void;
  onRole: (v: string) => void;
  onOpenTo: (v: string) => void;
  action?: (p: PersonCard) => React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="people-q" className="mb-1 block text-sm font-medium">
          Who are you looking for?
        </label>
        <input
          id="people-q"
          type="search"
          className={`${control} text-lg`}
          value={q}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Who can help me with GATE and a backlog?"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by role">
        {ROLE_FILTERS.map(([v, label]) => (
          <button key={v || "all"} type="button" onClick={() => onRole(v)} aria-pressed={role === v} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${role === v ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--ink)]/25 bg-white"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by what they are open to">
        <span className="text-sm text-[var(--muted)]">Open to</span>
        {["", ...OPEN_TO].map((v) => (
          <button key={v || "any"} type="button" onClick={() => onOpenTo(v)} aria-pressed={openTo === v} className={`rounded-full border px-3 py-1 text-xs font-medium ${openTo === v ? "border-[var(--ink)] bg-[var(--yellow)]" : "border-[var(--ink)]/25 bg-white"}`}>
            {v ? OPEN_TO_LABELS[v as OpenTo] : "Anything"}
          </button>
        ))}
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {people.length === 0 ? (
          <p className="rounded-[22px] bg-white p-6 text-[var(--muted)]">
            {loading ? "Searching…" : q.trim() ? "Nobody matches that yet. Try fewer words, or ask about a topic such as GATE, React or referrals." : "No suggestions yet. Complete your profile and journey to get better ones."}
          </p>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {people.map((p) => (
              <Person key={p.id} p={p} action={action} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
