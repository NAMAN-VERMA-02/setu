"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useFedLive } from "@/lib/fed/client";
import { createClient } from "@/lib/supabase/client";

type Dir = { pid: string; node_id: string; role: string; branch_code: string | null; grad_year: number | null; public_title: string | null; public_company: string | null };
type Hop = { idx: number; from_pid: string; to_pid: string; status: string };
type Audit = { id: number; node_id: string | null; call: string; identifying_fields: number; ms: number | null };

const NODE_URL: Record<string, string | undefined> = { ngit: process.env.NEXT_PUBLIC_NODE_NGIT_URL, rce: process.env.NEXT_PUBLIC_NODE_RCE_URL, pro: process.env.NEXT_PUBLIC_NODE_PRO_URL };

/** Proof on screen: the hub's own raw rows next to the college's own console. */
export function PrivacyView() {
  const [dir, setDir] = useState<Dir[]>([]);
  const [hops, setHops] = useState<Hop[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [totals, setTotals] = useState({ identifying: 0, calls: 0, released: 0 });
  const [open, setOpen] = useState<"ngit" | "rce" | "pro">("ngit");

  const load = useCallback(async () => {
    const db = createClient();
    const [d, h, a, all, ngit, rce, pro] = await Promise.all([
      db.from("fed_directory").select("pid, node_id, role, branch_code, grad_year, public_title, public_company").order("created_at", { ascending: false }).limit(6),
      db.from("fed_hops").select("idx, from_pid, to_pid, status").order("sent_at", { ascending: false, nullsFirst: false }).limit(5),
      db.from("fed_audit").select("id, node_id, call, identifying_fields, ms").order("id", { ascending: false }).limit(6),
      db.from("fed_audit").select("identifying_fields").limit(20000),
      api<{ residency?: { namesReleased: number | null } }>("/api/fed/college/ngit"),
      api<{ residency?: { namesReleased: number | null } }>("/api/fed/college/rce"),
      api<{ residency?: { namesReleased: number | null } }>("/api/fed/college/pro"),
    ]);
    setDir((d.data ?? []) as Dir[]);
    setHops((h.data ?? []) as Hop[]);
    setAudit((a.data ?? []) as Audit[]);
    const rows = (all.data ?? []) as { identifying_fields: number }[];
    setTotals({
      identifying: rows.reduce((s, r) => s + r.identifying_fields, 0),
      calls: rows.length,
      released: (ngit.data.residency?.namesReleased ?? 0) + (rce.data.residency?.namesReleased ?? 0) + (pro.data.residency?.namesReleased ?? 0),
    });
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_audit", "fed_hops", "fed_directory"], load);

  const adminUrl = NODE_URL[open] ? `${NODE_URL[open]}/admin` : null;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">What Setu actually holds</p>
        <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">Look inside the hub.</h1>
      </header>

      <section aria-label="Counters" className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[22px] bg-[var(--ink)] p-6 text-white">
          <p className="text-7xl font-black tabular-nums">{totals.identifying}</p>
          <p className="mt-2 text-lg opacity-80">identifying fields received by the Setu Hub</p>
        </div>
        <div className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <p className="text-7xl font-black tabular-nums">{totals.calls}</p>
          <p className="mt-2 text-lg text-[var(--muted)]">hub → college calls, each one logged</p>
        </div>
        <div className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <p className="text-7xl font-black tabular-nums">{totals.released}</p>
          <p className="mt-2 text-lg text-[var(--muted)]">names released, straight from a college to someone who said yes</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[22px] bg-[var(--surface)] p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]" aria-label="Setu Hub database">
          <h2 className="text-2xl font-black">Setu Hub database · live</h2>
          <p className="text-base text-[var(--muted)]">Raw rows, exactly as stored. Look for a name.</p>
          <div className="mt-3 space-y-4 overflow-x-auto font-mono text-sm leading-relaxed">
            <div>
              <p className="font-bold">fed_directory</p>
              {dir.map((r) => (
                <p key={r.pid} className="whitespace-nowrap">
                  {r.pid} | {r.role} | {r.branch_code ?? "-"} | {r.grad_year ?? "-"} | {r.public_title ?? "-"} | {r.public_company ?? "-"}
                </p>
              ))}
            </div>
            <div>
              <p className="font-bold">fed_hops</p>
              {hops.map((r, i) => (
                <p key={i} className="whitespace-nowrap">
                  {r.idx} | {r.from_pid} → {r.to_pid} | {r.status}
                </p>
              ))}
            </div>
            <div>
              <p className="font-bold">fed_audit</p>
              {audit.map((r) => (
                <p key={r.id} className="whitespace-nowrap">
                  {r.node_id ?? "hub"} | {r.call} | identifying_fields={r.identifying_fields} | {r.ms ?? "-"}ms
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[22px] bg-[var(--surface)] p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]" aria-label="College console">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black">The college’s own console</h2>
            <div className="flex gap-2">
              {(["ngit", "rce", "pro"] as const).map((n) => (
                <button key={n} type="button" onClick={() => setOpen(n)} aria-pressed={open === n} className={`rounded-full px-4 py-1.5 text-base font-bold ${open === n ? "bg-[var(--ink)] text-white" : "border border-[var(--ink)]/30"}`}>
                  {n.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <p className="text-base text-[var(--muted)]">Served from {NODE_URL[open] ?? "the college’s server"}, not from Setu.</p>
          {adminUrl ? <iframe title={`${open} admin console`} src={adminUrl} className="mt-3 h-[520px] w-full rounded-xl border border-[var(--ink)]/15 bg-white" /> : <p className="mt-3 text-[var(--muted)]">Server URL not configured.</p>}
        </section>
      </div>
    </div>
  );
}
