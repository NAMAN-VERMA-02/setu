"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NeedSession } from "@/components/live/need-session";
import { useFedLive, useNames, type SessionInfo, type ViewerTokens } from "@/lib/fed/client";
import { createClient } from "@/lib/supabase/client";

type Intro = { id: string; target: string; status: string; success_prob: number | null; created_at: string };
type Pay = { id: string; junior_pid: string; status: string };

function Body({ session, viewer, ledger }: { session: SessionInfo; viewer: ViewerTokens; ledger: { points: number; karz: number; score: number } }) {
  const [intros, setIntros] = useState<Intro[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [pay, setPay] = useState<Pay[]>([]);
  const names = useNames(viewer, [session.pid]);

  const load = useCallback(async () => {
    const db = createClient();
    const [i, board, p] = await Promise.all([
      db.from("fed_intros").select("id, target, status, success_prob, created_at").eq("requester", session.pid).eq("is_history", false).order("created_at", { ascending: false }).limit(10),
      db.from("fed_leaderboard").select("pid, score").eq("node_id", session.node).order("score", { ascending: false }).limit(200),
      db.from("fed_payforward").select("id, junior_pid, status").eq("helper_pid", session.pid).eq("status", "open").limit(10),
    ]);
    setIntros((i.data ?? []) as Intro[]);
    setPay((p.data ?? []) as Pay[]);
    const idx = ((board.data ?? []) as { pid: string }[]).findIndex((r) => r.pid === session.pid);
    setRank(idx >= 0 ? idx + 1 : null);
  }, [session.pid, session.node]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_intros", "fed_ledger", "fed_payforward"], load);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">{session.label}</p>
        <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">{names[session.pid] ?? "You"}</h1>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          ["Points", `+${ledger.points}`],
          ["Karz", `−${ledger.karz}`],
          ["Rank score", String(ledger.score)],
          [`${session.node.toUpperCase()} rank`, rank ? `#${rank}` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[22px] bg-[var(--surface)] p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
            <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{k}</p>
            <p className="mt-1 text-5xl font-black tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      {pay.length > 0 && (
        <section className="rounded-[22px] bg-[var(--sage)] p-6">
          <h2 className="text-2xl font-black">Pay it forward</h2>
          <p className="mt-1 text-lg">{pay.length} juniors are where you once were. Answer one question each for +25 Points.</p>
        </section>
      )}

      <section className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <h2 className="text-2xl font-black">My intros</h2>
        {intros.length === 0 && (
          <p className="mt-2 text-[var(--muted)]">
            None yet. Start from <Link href="/live/mirror" className="font-semibold underline">Mirror</Link>.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {intros.map((i) => (
            <li key={i.id}>
              <Link href={`/live/intro/${i.id}`} className="flex items-center justify-between rounded-xl bg-[var(--paper)] p-4 text-lg font-semibold">
                <span>{i.status.replace("_", " ")}</span>
                <span className="tabular-nums text-[var(--muted)]">{i.success_prob ? `${Math.round(i.success_prob * 1000) / 10}%` : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function MeView() {
  return <NeedSession>{({ session, viewer, ledger }) => <Body session={session} viewer={viewer} ledger={ledger} />}</NeedSession>;
}
