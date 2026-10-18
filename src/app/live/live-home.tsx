"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NodePill } from "@/components/live/live-header";
import { api, COLLEGE_COLOUR, useFedLive, useNodeHealth, useSession } from "@/lib/fed/client";
import { createClient } from "@/lib/supabase/client";

const PERSONAS = [
  { key: "aman", label: "Aman", note: "NGIT student, sem 5" },
  { key: "rohan", label: "Rohan", note: "NGIT student, sem 7" },
  { key: "vikram", label: "Vikram", note: "RCE alum, FinStack" },
  { key: "priya", label: "Priya", note: "NGIT alum ’22" },
  { key: "meera", label: "Meera", note: "RCE alum, FinStack" },
  { key: "ananya", label: "Dr. Ananya", note: "Cardiologist, needs a developer", pro: true },
  { key: "rahul", label: "Rahul", note: "CTO, health-IT company", pro: true },
  { key: "ishaan", label: "Ishaan", note: "Developer who builds health apps", pro: true },
  { key: "ngit_pc", label: "NGIT placement cell", note: "college dashboard" },
  { key: "rce_pc", label: "RCE placement cell", note: "college dashboard" },
];

const NODE_URL: Record<string, string | undefined> = {
  ngit: process.env.NEXT_PUBLIC_NODE_NGIT_URL,
  rce: process.env.NEXT_PUBLIC_NODE_RCE_URL,
  pro: process.env.NEXT_PUBLIC_NODE_PRO_URL,
};

type AuditRow = { id: number; node_id: string | null; call: string; identifying_fields: number; note: string | null };

/** Projector home: two college servers, the hub, a live privacy ticker and the persona picker. */
export function LiveHome() {
  const router = useRouter();
  const { nodes } = useNodeHealth();
  const { session } = useSession();
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const { data } = await createClient().from("fed_audit").select("id, node_id, call, identifying_fields, note").order("id", { ascending: false }).limit(5);
    setAudit((data ?? []) as AuditRow[]);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_audit"], load);

  async function pick(key: string, placement: boolean, professional: boolean) {
    setBusy(key);
    const r = await api("/api/fed/persona", { method: "POST", json: { story_key: key } });
    setBusy("");
    // students start at Mirror, professionals at Find, placement cells at their dashboard
    if (r.ok) router.push(placement ? `/live/college/${key.startsWith("rce") ? "rce" : "ngit"}` : professional ? "/live/find" : "/live/mirror");
  }

  return (
    <div className="space-y-10">
      <section>
        <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">Federated by design</p>
        <h1 className="mt-2 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">
          Every network keeps its people.
          <br />
          <span className="font-serif font-normal normal-case italic">Setu only routes.</span>
        </h1>
        <p className="mt-3 max-w-3xl text-xl text-[var(--muted)]">Two colleges and a professional network, each on its own server. A student, a doctor and a developer can all find each other without anyone handing over a database.</p>
      </section>

      <section aria-label="Servers" className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {(nodes.length ? nodes : [{ id: "ngit", name: "Northgate Institute of Technology", city: "Delhi", status: "unknown", latencyMs: null, people: 0 }, { id: "rce", name: "Riverbend College of Engineering", city: "Noida", status: "unknown", latencyMs: null, people: 0 }, { id: "pro", name: "Setu Professionals", city: "Pan-India", status: "unknown", latencyMs: null, people: 0 }] as const).map((n) => (
          <article key={n.id} className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]" style={{ borderTop: `6px solid ${COLLEGE_COLOUR[n.id]}` }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{n.id === "pro" ? "Professional server" : "College server"}</p>
              <NodePill id={n.id} status={n.status} label={n.status === "online" ? "ONLINE" : n.status === "unknown" ? "…" : "OFFLINE"} />
            </div>
            <h2 className="mt-3 text-3xl font-black leading-tight">{n.name}</h2>
            <p className="text-[var(--muted)]">{n.city}</p>
            <p className="mt-4 break-all font-mono text-sm text-[var(--muted)]">{NODE_URL[n.id] ?? "server not configured"}</p>
            <div className="mt-5 flex items-end justify-between">
              <p>
                <span className="text-6xl font-black leading-none tabular-nums">{n.status === "online" ? n.people : "—"}</span>
                <span className="ml-2 text-[var(--muted)]">people on this server</span>
              </p>
              <p className="text-sm text-[var(--muted)]">{n.latencyMs != null ? `${n.latencyMs} ms` : ""}</p>
            </div>
          </article>
        ))}

        <article className="rounded-[22px] bg-[var(--ink)] p-6 text-white">
          <p className="text-sm font-bold uppercase tracking-wide opacity-70">Setu Hub</p>
          <h2 className="mt-3 text-3xl font-black leading-tight">A blind router</h2>
          <ul className="mt-4 space-y-2 text-base opacity-90">
            <li>✓ Pseudonymous IDs</li>
            <li>✓ Scores and consent events</li>
            <li>✓ Edge probabilities</li>
            <li className="opacity-70">✕ Names, emails, CGPA, messages</li>
          </ul>
        </article>
      </section>

      <section aria-label="What the hub received" className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Privacy ticker · live</h2>
        <ul className="mt-3 space-y-1.5 font-mono text-base">
          {audit.length === 0 && <li className="text-[var(--muted)]">Waiting for activity…</li>}
          {audit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3">
              <span style={{ color: COLLEGE_COLOUR[a.node_id ?? ""] }} className="font-bold">
                {(a.node_id ?? "hub").toUpperCase()}
              </span>
              <span>{a.note ?? a.call}</span>
              <span className="text-[var(--muted)]">· {a.identifying_fields} identifying fields</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Pick who to play">
        <h2 className="text-2xl font-black">{session ? "Switch persona" : "Pick who to play"}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={busy === p.key}
              onClick={() => pick(p.key, p.key.endsWith("_pc"), "pro" in p && p.pro === true)}
              className="rounded-2xl bg-[var(--surface)] p-5 text-left shadow-[0_0_0_1px_rgba(15,15,14,.08)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              <span className="block text-xl font-black">{p.label}</span>
              <span className="text-base text-[var(--muted)]">{p.note}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-base text-[var(--muted)]">Demo personas are labelled. Real visitors join from their own phone at /join.</p>
      </section>

    </div>
  );
}
