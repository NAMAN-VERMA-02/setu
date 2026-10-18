"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { PathGraph, type GraphEdge, type GraphPerson, type HopState } from "@/components/live/path-graph";
import { api, useFedLive, useNames, type ViewerTokens } from "@/lib/fed/client";

type Hop = { id: string; idx: number; from_pid: string; to_pid: string; status: HopState; is_target: boolean };
type Intro = { id: string; requester: string; target: string; status: string; trust_step: string; response: string | null; success_prob: number | null; shortest_prob: number | null };
type EventRow = { id: number; kind: string; text: string; created_at: string };
type IntroResponse = {
  intro: Intro;
  hops: Hop[];
  events: EventRow[];
  people: (GraphPerson & { node: string })[];
  edges: GraphEdge[];
  isRequester: boolean;
  viewer: ViewerTokens | null;
};
type Note = { author_pid: string; text: string };

const RESPONSE_LABEL: Record<string, string> = { question: "answered your question", call: "15-min call", referral: "referral" };

function statusLine(intro: Intro, hops: Hop[]): { text: string; tone: "wait" | "good" | "bad" } {
  if (intro.status === "hired") return { text: "Hired. Everyone on the chain earned +100.", tone: "good" };
  if (intro.status === "delivered") return { text: "Delivered. Your intro reached them.", tone: "good" };
  if (intro.status === "failed") return { text: "No other route was found.", tone: "bad" };
  if (intro.status === "needs_reroute") return { text: "Someone couldn’t help — re-routing…", tone: "bad" };
  // count only hops still on the live route, so a re-route never reads "hop 4 of 3"
  const live = hops.filter((h) => h.status !== "cancelled" && h.status !== "declined").sort((a, b) => a.idx - b.idx);
  const position = live.findIndex((h) => h.status === "sent") + 1;
  return { text: position > 0 ? `Waiting for hop ${position} of ${live.length}…` : "Working…", tone: "wait" };
}

export function IntroView({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const [data, setData] = useState<IntroResponse | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);

  const load = useCallback(async () => {
    const r = await api<IntroResponse & { error?: string }>(`/api/fed/intro/${id}`);
    if (r.ok) setData(r.data);
    else setError(r.data.error ?? "Could not load this intro.");
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useFedLive(["fed_hops", "fed_intros", "fed_events"], load);

  const viewer = data?.viewer ?? {};
  // A name is shown only once that person has said yes (plus the requester's own). Waiting people stay anonymous,
  // even though a college would hand out the name of anyone who chose to be on its leaderboard.
  const nameable = data ? [data.intro.requester, ...data.hops.filter((h) => h.status === "accepted").map((h) => h.to_pid)] : [];
  const names = useNames(viewer, nameable);

  // notes live on the requester's own college server; read them straight from there
  const requesterNode = data?.intro.requester.split("_")[0] as "ngit" | "rce" | "pro" | undefined;
  const eventCount = data?.events.length ?? 0;
  useEffect(() => {
    const v = requesterNode ? viewer[requesterNode] : undefined;
    if (!v || !data?.isRequester) return;
    let alive = true;
    fetch(`${v.url}/public/asks/${id}`, { headers: { "x-setu-viewer": v.token } })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { notes?: Note[] } | null) => alive && b?.notes && setNotes(b.notes))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // refetch whenever a new event arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, requesterNode, eventCount, data?.isRequester, Object.keys(viewer).length]);

  if (error) return <p role="alert" className="rounded-xl bg-[var(--surface)] p-5 text-[var(--red)]">{error}</p>;
  if (!data) return <div className="h-96 animate-pulse rounded-[22px] bg-[var(--surface)]" role="status" aria-label="Loading your intro" />;

  const { intro, hops } = data;
  const hopState: Record<string, HopState> = {};
  for (const h of hops) hopState[`${h.from_pid}|${h.to_pid}`] = h.status;

  // the live chain: requester, then each hop that has not been declined or cancelled
  const live = hops.filter((h) => h.status !== "declined" && h.status !== "cancelled").sort((a, b) => a.idx - b.idx);
  const chain = [intro.requester, ...live.map((h) => h.to_pid)];
  const line = statusLine(intro, hops);
  const accepted = hops.filter((h) => h.status === "accepted");
  const finalHop = hops.find((h) => h.is_target && h.status === "accepted");
  const tone = line.tone === "good" ? "bg-[var(--sage)]" : line.tone === "bad" ? "bg-[var(--red-tile)]/25" : "bg-[var(--yellow)]/50";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">Live intro</p>
          <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">{line.tone === "good" ? "Delivered." : "On its way."}</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Chance of success</p>
          <p className="text-6xl font-black tabular-nums" aria-live="polite">
            {intro.success_prob != null ? `${Math.round(intro.success_prob * 1000) / 10}%` : "—"}
          </p>
        </div>
      </header>

      <p role="status" aria-live="polite" className={`rounded-2xl p-5 text-2xl font-bold ${tone}`}>
        {line.text}
      </p>

      {finalHop && (
        <div className="rounded-[22px] bg-[var(--ink)] p-8 text-white">
          <p className="text-sm font-bold uppercase tracking-wide opacity-70">Result</p>
          <p className="mt-2 text-4xl font-black">
            {names[finalHop.to_pid] ?? "Your target"} · {RESPONSE_LABEL[intro.response ?? "question"] ?? "answered"}
          </p>
        </div>
      )}

      <section className="rounded-[22px] bg-[var(--surface)] p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <PathGraph people={data.people} edges={data.edges} source={intro.requester} target={intro.target} best={chain} hops={hopState} names={names} />
        <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-base text-[var(--muted)]">
          <li>● grey: waiting</li>
          <li style={{ color: "#b45309" }}>● amber: asked</li>
          <li style={{ color: "#15803d" }}>● green: said yes</li>
          <li style={{ color: "#b91c1c" }}>✕ red: couldn’t help</li>
        </ul>
        {hops.some((h) => h.status === "declined") && <p className="mt-3 text-lg font-semibold">You will never know who said no.</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <h2 className="text-2xl font-black">What’s happened</h2>
          <ol className="mt-3 space-y-2">
            {data.events.map((e) => (
              <li key={e.id} className="flex gap-3 text-lg">
                <span className="mt-2 size-2.5 shrink-0 rounded-full bg-[var(--ink)]" />
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
          <h2 className="text-2xl font-black">Said yes</h2>
          {accepted.length === 0 && <p className="mt-2 text-[var(--muted)]">No one yet. Names appear here only after someone says yes.</p>}
          <ul className="mt-3 space-y-3">
            {accepted.map((h) => {
              const note = notes.filter((n) => n.author_pid === h.to_pid).at(-1);
              return (
                <li key={h.id} className="rounded-xl bg-[var(--paper)] p-4">
                  <p className="text-xl font-bold">{names[h.to_pid] ?? "…"}</p>
                  <p className="text-base text-[var(--muted)]">
                    {data.people.find((p) => p.pid === h.to_pid)?.title ?? "Alum"} {data.people.find((p) => p.pid === h.to_pid)?.company ? `· ${data.people.find((p) => p.pid === h.to_pid)?.company}` : ""} · +10 Points
                  </p>
                  {note && <p className="mt-2 text-lg">“{note.text}”</p>}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-[var(--muted)]">Names and notes come straight from each person’s college server to your browser. The hub never holds them.</p>
        </section>
      </div>

      <Link href="/live/leaderboard" className="inline-block rounded-full border border-[var(--ink)] px-6 py-3 text-lg font-semibold">
        See the leaderboard
      </Link>
    </div>
  );
}
