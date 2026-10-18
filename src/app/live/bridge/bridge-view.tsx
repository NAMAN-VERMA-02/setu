"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NeedSession } from "@/components/live/need-session";
import { PathGraph, type GraphEdge, type GraphPerson } from "@/components/live/path-graph";
import { api, COLLEGE_COLOUR, type SessionInfo, type ViewerTokens } from "@/lib/fed/client";

type Target = { pid: string; node: string; role: string; label: string; title: string | null; company: string | null; gradYear: number | null; offline: boolean };
type Path = { path: string[]; prob: number; hops: { a: string; b: string; p: number }[] };
type RouteResponse =
  | { status: "ok"; best: Path; shortest: Path | null; nodes: GraphPerson[]; edges: GraphEdge[] }
  | { status: "target_offline" | "no_route"; message: string };

const pct = (n: number) => `${(n * 100).toFixed(n * 100 >= 10 ? 1 : 2).replace(/\.0+$/, "")}%`;
const math = (p: Path) => p.hops.map((h) => h.p).join(" × ");

function Composer({ session, viewer, target, route }: { session: SessionInfo; viewer: ViewerTokens; target: Target; route: Extract<RouteResponse, { status: "ok" }> }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [trust, setTrust] = useState<"question" | "call" | "referral">("question");
  const [work, setWork] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function draft() {
    setBusy("draft");
    const r = await api<{ draft?: string }>("/api/fed/draft", { method: "POST", json: { target: target.pid } });
    setBusy("");
    setText(r.ok && r.data.draft ? r.data.draft : "");
  }

  async function send() {
    setBusy("send");
    setError("");
    const r = await api<{ intro_id?: string; error?: string }>("/api/fed/intro", { method: "POST", json: { target: target.pid, trust_step: work && trust === "referral" ? "referral" : trust } });
    if (!r.ok || !r.data.intro_id) {
      setBusy("");
      setError(r.data.error ?? "We could not send that.");
      return;
    }
    // the ask text goes straight to your own server, never through the hub
    const own = viewer[session.node];
    if (own && text.trim()) {
      // {myName} is filled in here, on your device, from your own server
      let message = text.trim();
      if (message.includes("{myName}")) {
        const card = await fetch(`${own.url}/public/card/${session.pid}`, { headers: { "x-setu-viewer": own.token } })
          .then((res) => (res.ok ? (res.json() as Promise<{ name?: string }>) : null))
          .catch(() => null);
        message = message.replaceAll("{myName}", card?.name ?? "Someone on Setu");
      }
      await fetch(`${own.url}/public/asks`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-setu-viewer": own.token },
        body: JSON.stringify({ intro_id: r.data.intro_id, text: message, work_url: work.trim() || null }),
      }).catch(() => {});
    }
    router.push(`/live/intro/${r.data.intro_id}`);
  }

  const referralLocked = !work.trim();
  return (
    <div className="rounded-[22px] bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
      <h2 className="text-2xl font-black">Your message</h2>
      <p className="text-base text-[var(--muted)]">It is stored on {session.node === "pro" ? "the professional network’s" : `${session.node.toUpperCase()}’s`} server. The hub never sees the words.</p>
      <label className="sr-only" htmlFor="ask">
        Message
      </label>
      <textarea
        id="ask"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        maxLength={900}
        placeholder={session.role === "professional" ? "Hi, I run a clinic and need a patient follow-up app. Could we talk for 15 minutes about how you would build it?" : "Hi, I’m a 3rd-year ECE student building ML projects. Could you spare 15 minutes to tell me how you got your first ML role?"}
        className="mt-3 w-full rounded-xl border border-[var(--ink)]/20 bg-[var(--paper)] p-4 text-lg"
      />
      <fieldset className="mt-4">
        <legend className="text-base font-bold">What are you asking for?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["question", "A question"],
              ["call", "A 15-minute call"],
              ["referral", "A referral"],
            ] as const
          ).map(([v, label]) => {
            const locked = v === "referral" && referralLocked;
            return (
              <label key={v} className={`rounded-full border px-5 py-2.5 text-base font-semibold ${trust === v ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--ink)]/25"} ${locked ? "opacity-50" : "cursor-pointer"}`}>
                <input type="radio" name="trust" className="sr-only" disabled={locked} checked={trust === v} onChange={() => setTrust(v)} />
                {label}
                {locked ? " 🔒" : ""}
              </label>
            );
          })}
        </div>
        <label className="mt-3 block text-base">
          <span className="font-semibold">Link to your work</span> <span className="text-[var(--muted)]">(unlocks a referral ask)</span>
          <input value={work} onChange={(e) => setWork(e.target.value)} inputMode="url" placeholder="https://github.com/you/project" className="mt-1 w-full rounded-xl border border-[var(--ink)]/20 bg-[var(--paper)] p-3" />
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="mt-3 text-[var(--red)]">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={draft} disabled={busy !== ""} className="rounded-full border border-[var(--ink)] px-6 py-3 text-lg font-semibold disabled:opacity-60">
          {busy === "draft" ? "Drafting…" : "Draft with AI"}
        </button>
        <button type="button" onClick={send} disabled={busy !== ""} className="rounded-full bg-[var(--ink)] px-8 py-3 text-lg font-bold text-white disabled:opacity-60">
          {busy === "send" ? "Sending…" : "Send"}
        </button>
        <p className="text-base text-[var(--muted)]">Asking adds 10 Karz (debt). Helpers earn Points, and Rank = Points − Karz.</p>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Route: {route.best.path.length - 2} {route.best.path.length - 2 === 1 ? "person" : "people"} in between · {pct(route.best.prob)} chance
      </p>
    </div>
  );
}

function BridgeBody({ session, viewer }: { session: SessionInfo; viewer: ViewerTokens }) {
  const params = useSearchParams();
  const preset = params.get("target");
  // arriving with a chosen person (from Find, Mirror or Ask) means no default search list
  const [q, setQ] = useState(preset ? "" : "FinStack");
  const [targets, setTargets] = useState<Target[]>([]);
  const [chosen, setChosen] = useState<Target | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const search = useCallback(async (term: string) => {
    const r = await api<{ targets: Target[] }>(`/api/fed/targets?q=${encodeURIComponent(term)}`);
    if (r.ok) setTargets(r.data.targets);
  }, []);
  useEffect(() => {
    if (preset) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void search(q);
    // run once for the starting search text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = useCallback(
    async (t: Target) => {
      setChosen(t);
      setRoute(null);
      setLoadingRoute(true);
      const r = await api<RouteResponse>(`/api/fed/route?target=${encodeURIComponent(t.pid)}`);
      setLoadingRoute(false);
      setRoute(r.ok ? r.data : { status: "no_route", message: "Could not plan a route right now." });
    },
    [],
  );

  // arriving from Mirror with ?target=
  useEffect(() => {
    if (!preset) return;
    let alive = true;
    // look the person up by id: a search would only return the first few dozen people in the network
    api<{ targets: Target[] }>(`/api/fed/targets?pid=${encodeURIComponent(preset)}`).then((r) => {
      const t = r.data.targets?.find((x) => x.pid === preset);
      if (alive && t) {
        setTargets([t]); // show who was chosen
        void choose(t);
      }
    });
    return () => {
      alive = false;
    };
  }, [preset, choose]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-base font-semibold uppercase tracking-wide text-[var(--muted)]">Bridge · warm intros, max 3 people between</p>
        <h1 className="mt-1 text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl">The path most likely to say yes.</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
        className="flex flex-wrap gap-3"
      >
        <label className="sr-only" htmlFor="company">
          Company or role
        </label>
        <input id="company" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company or role, e.g. FinStack" className="min-w-0 flex-1 rounded-full border border-[var(--ink)]/25 bg-[var(--surface)] px-6 py-3 text-lg" />
        <button className="rounded-full bg-[var(--ink)] px-7 py-3 text-lg font-semibold text-white">Search</button>
      </form>

      <ul className="grid gap-3 md:grid-cols-2">
        {targets.slice(0, 8).map((t) => (
          <li key={t.pid}>
            <button
              type="button"
              onClick={() => choose(t)}
              aria-pressed={chosen?.pid === t.pid}
              className={`w-full rounded-2xl p-4 text-left shadow-[0_0_0_1px_rgba(15,15,14,.1)] ${chosen?.pid === t.pid ? "bg-[var(--ink)] text-white" : "bg-[var(--surface)]"}`}
              style={{ borderLeft: `6px solid ${COLLEGE_COLOUR[t.node]}` }}
            >
              <span className="block text-lg font-bold">{t.title ?? t.role}</span>
              <span className="text-base opacity-80">
                {t.company} · {t.role === "professional" ? "Setu Professionals" : `${t.node.toUpperCase()} alum${t.gradYear ? ` ’${String(t.gradYear).slice(-2)}` : ""}`}
                {t.offline ? " · offline" : ""}
              </span>
            </button>
          </li>
        ))}
        {targets.length === 0 && <li className="text-[var(--muted)]">No one found. Try “FinStack”.</li>}
      </ul>

      {loadingRoute && <div className="h-72 animate-pulse rounded-[22px] bg-[var(--surface)]" role="status" aria-label="Planning the route" />}

      {route && route.status !== "ok" && (
        <p role="status" className="rounded-xl bg-[var(--red-tile)]/20 p-5 text-xl font-bold">
          {route.message}
        </p>
      )}

      {route && route.status === "ok" && chosen && (
        <>
          <section className="rounded-[22px] bg-[var(--surface)] p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
            <PathGraph people={route.nodes} edges={route.edges} source={session.pid} target={chosen.pid} best={route.best.path} shortest={route.shortest?.path} />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-[var(--sage)] p-5">
                <p className="text-sm font-bold uppercase tracking-wide">Best path · most likely to say yes</p>
                <p className="mt-1 font-mono text-xl font-bold">
                  {math(route.best)} = <span className="text-3xl">{pct(route.best.prob)}</span>
                </p>
                <p className="text-base">{route.best.path.length - 2} {route.best.path.length - 2 === 1 ? "person" : "people"} in between</p>
              </div>
              {route.shortest && route.shortest.path.join() !== route.best.path.join() && (
                <div className="rounded-2xl bg-[var(--stone)] p-5">
                  <p className="text-sm font-bold uppercase tracking-wide">Shortest path · fewest people</p>
                  <p className="mt-1 font-mono text-xl font-bold">
                    {math(route.shortest)} = <span className="text-3xl">{pct(route.shortest.prob)}</span>
                  </p>
                  <p className="text-base">Shorter is not better: each hop is a person who can say no.</p>
                </div>
              )}
            </div>
          </section>
          <Composer session={session} viewer={viewer} target={chosen} route={route} />
        </>
      )}
    </div>
  );
}

export function BridgeView() {
  return <NeedSession>{({ session, viewer }) => <BridgeBody session={session} viewer={viewer} />}</NeedSession>;
}
