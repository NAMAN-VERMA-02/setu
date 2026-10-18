"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NodePill } from "@/components/live/live-header";
import { api, useFedLive, useNodeHealth } from "@/lib/fed/client";

type Hop = { id: string; idx: number; status: string; isTarget: boolean; storyKey: string | null; label: string; link: string | null };
type Intro = { id: string; requester: string; target: string; status: string; success_prob: number | null; hops: Hop[] };
type State = { siteUrl: string; joinQr: boolean; hopQr: boolean; intros: Intro[] };

const NODE_URL: Record<string, string | undefined> = { ngit: process.env.NEXT_PUBLIC_NODE_NGIT_URL, rce: process.env.NEXT_PUBLIC_NODE_RCE_URL, pro: process.env.NEXT_PUBLIC_NODE_PRO_URL };
const PERSONAS = ["aman", "rohan", "vikram", "priya", "meera", "ananya", "rahul", "ishaan"];

const btn = "rounded-xl bg-[var(--ink)] px-5 py-3 text-lg font-bold text-white disabled:opacity-50";
const ghost = "rounded-xl border-2 border-[var(--ink)] px-5 py-3 text-lg font-bold disabled:opacity-50";

/** Presenter control. Never projected: warm up, reset, QR toggles, hire, links. */
export function StageView() {
  const key = useSearchParams().get("key") ?? "";
  const { nodes, refresh } = useNodeHealth(5000);
  const [state, setState] = useState<State | null>(null);
  const [denied, setDenied] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState("");

  const headers = { "x-stage-key": key };
  const say = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 8));

  const [tick, setTick] = useState(0);
  const load = () => setTick((t) => t + 1);
  useEffect(() => {
    let alive = true;
    api<State>("/api/fed/stage", { headers: { "x-stage-key": key } }).then((r) => {
      if (!alive) return;
      if (r.status === 403) setDenied(true);
      else if (r.ok) setState(r.data);
    });
    return () => {
      alive = false;
    };
  }, [key, tick]);
  useFedLive(["fed_intros", "fed_hops", "fed_events"], load);

  async function warm() {
    setBusy("warm");
    say("Warming up both college servers…");
    for (let i = 0; i < 4; i++) {
      await refresh();
      await Promise.all(Object.values(NODE_URL).map((u) => (u ? fetch(`${u}/health`, { cache: "no-store" }).catch(() => null) : null)));
    }
    await refresh();
    setBusy("");
    say("Warm-up done. Check the lights.");
  }
  async function reset() {
    setBusy("reset");
    say("Resetting the demo…");
    const r = await api<{ ms?: number; people?: number; error?: string; nodesOffline?: string[] }>("/api/fed/admin/reset", { method: "POST", headers });
    setBusy("");
    say(r.ok ? `Reset done in ${r.data.ms} ms · ${r.data.people} people${r.data.nodesOffline?.length ? ` · OFFLINE: ${r.data.nodesOffline.join(", ")}` : ""}` : `Reset failed: ${r.data.error}`);
    void load();
    void refresh();
  }
  async function stage(action: string) {
    await api("/api/fed/stage", { method: "POST", headers, json: { action } });
    void load();
  }
  async function hire(id: string) {
    setBusy(id);
    const r = await api<{ error?: string; helpers?: number }>(`/api/fed/intro/${id}/hire`, { method: "POST", headers });
    setBusy("");
    say(r.ok ? `Hired: +100 to ${r.data.helpers} people` : (r.data.error ?? "Could not mark hired"));
    void load();
  }

  if (!key || denied) return <p className="p-6 text-xl">Open this page as <code>/stage?key=…</code> with the presenter key.</p>;

  const origin = state?.siteUrl ?? "";
  const allGreen = nodes.length === 2 && nodes.every((n) => n.status === "online");
  // the demo person being asked right now (a guest can play them from a QR, or you can on this device)
  const askedNow = state?.intros.flatMap((i) => i.hops).find((h) => h.storyKey && h.link);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 text-lg">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black uppercase">Stage control</h1>
        <div className="flex items-center gap-2">
          {nodes.map((n) => (
            <span key={n.id} className="flex items-center gap-1">
              <NodePill id={n.id} status={n.status} />
              <span className="text-sm text-[var(--muted)]">{n.latencyMs != null ? `${n.latencyMs}ms` : ""}</span>
            </span>
          ))}
        </div>
      </header>
      <p role="status" className={`rounded-xl p-3 font-bold ${allGreen ? "bg-[var(--sage)]" : "bg-[var(--red-tile)]/25"}`}>
        {allGreen ? "All green. Ready." : "Not all green. Press Warm up, or check the node admin pages below."}
      </p>

      <section className="flex flex-wrap gap-3">
        <button className={btn} disabled={!!busy} onClick={warm}>{busy === "warm" ? "Warming…" : "Warm up"}</button>
        <button className={btn} disabled={!!busy} onClick={reset}>{busy === "reset" ? "Resetting…" : "Reset demo"}</button>
        <button className={ghost} onClick={() => stage(state?.joinQr ? "qr_join:off" : "qr_join:on")}>{state?.joinQr ? "Hide join QR" : "Show join QR"}</button>
        <button className={ghost} onClick={() => stage(state?.hopQr ? "qr_hop:off" : "qr_hop:on")}>{state?.hopQr ? "Hide the QR of who is asked" : "Show QR: guest plays who is asked"}</button>
      </section>

      <section className="rounded-2xl bg-[var(--surface)] p-5">
        <h2 className="text-2xl font-black">Live intros</h2>
        {(!state || state.intros.length === 0) && <p className="mt-2 text-[var(--muted)]">None yet.</p>}
        {state?.intros.map((i) => (
          <div key={i.id} className="mt-3 rounded-xl bg-[var(--paper)] p-4">
            <p className="font-bold">{i.requester} → {i.target}</p>
            <p className="text-base text-[var(--muted)]">{i.status.replace("_", " ")} {i.success_prob ? `· ${Math.round(i.success_prob * 1000) / 10}%` : ""}</p>
            <ul className="mt-2 space-y-1 text-base">
              {i.hops.map((h) => (
                <li key={h.id}>
                  hop {h.idx}: {h.label} · <strong>{h.status}</strong>
                  {h.link && (
                    <>
                      {" "}
                      · <a className="underline" href={h.link} target="_blank" rel="noopener noreferrer">open link</a>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className={ghost} href={`${origin}/live/intro/${i.id}`} target="_blank" rel="noopener noreferrer">Open intro screen</a>
              {i.status === "delivered" && <button className={btn} disabled={!!busy} onClick={() => hire(i.id)}>3 weeks later → Hired</button>}
            </div>
          </div>
        ))}
        {askedNow?.link && (
          <p className="mt-4 text-base">
            No one scans? <a className="font-bold underline" href={askedNow.link} target="_blank" rel="noopener noreferrer">Play {askedNow.label} on this device</a>
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-[var(--surface)] p-5">
        <h2 className="text-2xl font-black">Phone links</h2>
        <ul className="mt-2 space-y-1 text-base">
          {PERSONAS.map((p) => (
            <li key={p}>
              <a className="underline" href={`${origin}/live/inbox?as=${p}`} target="_blank" rel="noopener noreferrer">{origin}/live/inbox?as={p}</a>
            </li>
          ))}
          <li>
            <a className="underline" href={`${origin}/join`} target="_blank" rel="noopener noreferrer">{origin}/join</a>
          </li>
          {Object.entries(NODE_URL).map(([id, u]) => (
            <li key={id}>
              {id.toUpperCase()} admin: <a className="underline" href={`${u}/admin`} target="_blank" rel="noopener noreferrer">{u}/admin</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-[var(--surface)] p-5">
        <h2 className="text-2xl font-black">Rehearsal checklist</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-6 text-base">
          <li>Warm up → both lights green</li>
          <li>Reset demo (under 10 s)</li>
          <li>Phone A on inbox as Rohan, phone B as Meera</li>
          <li>Projector on /live</li>
          <li>Hotspot ready as a fallback</li>
        </ol>
      </section>

      <section aria-label="Log" className="font-mono text-sm text-[var(--muted)]">
        {log.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </section>
    </div>
  );
}
