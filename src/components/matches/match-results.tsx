import type { Match, TraitKey } from "@/lib/scoring";
import type { MatchResponse } from "@/lib/scoring/response";
import { AgentDrafts } from "./agent-drafts";
import { AskPanel } from "./ask-panel";
import { RouteList, RouteMap, routeSentence } from "./route-map";

const TRAIT_LABELS: Record<TraitKey, string> = {
  tier: "Same college tier",
  cgpa: "Similar CGPA",
  branch: "Same branch",
  backlogs: "Same backlogs",
  tenth: "Similar 10th marks",
  twelfth: "Similar 12th marks",
  decision: "Same direction",
};

function MatchCard({ m, bridgeBlocked, demo }: { m: Match; bridgeBlocked: boolean; demo?: boolean }) {
  const bridge = m.routes.find((r) => r.type === "via_senior");
  return (
    <li className="reveal rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-black uppercase leading-tight tracking-tight">{m.displayName}</h3>
          <p className="text-sm text-[var(--muted)]">
            Batch {m.batch} · {m.branch}
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-[var(--ink)] px-3 py-1 text-sm font-bold text-white" title="Match score out of 100">
          {m.score}
          <span className="font-normal opacity-70">/100</span>
        </div>
      </div>

      <p className="mt-4 border-l-4 border-[var(--yellow)] pl-3 text-base">{m.firstLine}</p>

      {m.sharedTraits.some((t) => t !== "tier") && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="What you share">
          {m.sharedTraits
            .filter((t) => t !== "tier")
            .map((t) => (
              <li key={t} className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-medium">
                {TRAIT_LABELS[t]}
              </li>
            ))}
        </ul>
      )}

      <p className="mt-4 text-sm text-[var(--muted)]">
        {bridge && bridge.type === "via_senior"
          ? `Knows ${bridge.contactCount} people at ${bridge.company}. They can pass your request on.`
          : "You can ask them a question directly."}
      </p>

      <AskPanel
        matchId={m.id}
        name={m.displayName}
        firstLine={m.firstLine}
        bridge={bridge && bridge.type === "via_senior" ? { company: bridge.company, contactCount: bridge.contactCount } : undefined}
        bridgeBlocked={bridgeBlocked}
        demo={demo}
      />
    </li>
  );
}

/** Pure view of a match response, used by the live page and the dev preview. */
export function MatchResults({ data, demo }: { data: MatchResponse; demo?: boolean }) {
  const sentence = routeSentence(data.routeMap);

  if (data.total === 0) {
    return (
      <p className="rounded-[22px] bg-white p-6">
        No seniors from your college match semester {data.semester} yet. As more seniors share their
        journeys, matches will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="route-h" className="rounded-[22px] bg-white p-5 sm:p-8 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
        <h2 id="route-h" className="text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">
          {data.total} {data.total === 1 ? "senior was" : "seniors were"} where you are
        </h2>
        {sentence && (
          <p className="mt-3 text-base text-[var(--muted)]">
            Here is what they did next: {sentence}.
          </p>
        )}
        <div className="mt-6 hidden sm:block">
          <RouteMap data={data.routeMap} semester={data.semester} />
        </div>
        <div className="mt-6 sm:hidden">
          <RouteList data={data.routeMap} />
        </div>
      </section>

      {data.bridgeBlocked && (
        <p role="status" className="rounded-xl bg-[var(--blue)]/40 p-4 text-sm">
          You already have a request waiting on a bridging senior. You can ask others directly meanwhile.
        </p>
      )}

      <AgentDrafts demo={demo} />

      <section aria-labelledby="who-h">
        <h2 id="who-h" className="mb-4 text-2xl font-black uppercase tracking-tight">
          Your closest matches
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.matches.map((m) => (
            <MatchCard key={m.id} m={m} bridgeBlocked={data.bridgeBlocked} demo={demo} />
          ))}
        </ul>
      </section>
    </div>
  );
}
