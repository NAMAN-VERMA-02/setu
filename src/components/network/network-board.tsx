"use client";

import Link from "next/link";
import type { ConnItem, ConnectionsResponse } from "@/lib/connections/types";
import { NetworkGraph } from "./network-graph";

type Act = (id: string, action: "accept" | "decline" | "remove") => Promise<boolean>;

function Row({ item, children }: { item: ConnItem; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-semibold">
          <Link href={`/people/${item.person.id}`} className="underline-offset-4 hover:underline">
            {item.person.name}
          </Link>
          <span className="ml-2 text-sm font-normal capitalize text-[var(--muted)]">{item.person.role}</span>
        </p>
        <p className="text-sm text-[var(--muted)]">{item.person.headline || [item.person.company, `${item.person.branch} · batch ${item.person.batch}`].filter(Boolean).join(" · ")}</p>
        {item.message && <p className="mt-1 text-sm">&ldquo;{item.message}&rdquo;</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </li>
  );
}

const btn = "rounded-full px-4 py-1.5 text-sm font-semibold";

/** The network picture, requests waiting on you, and everyone you are connected to. */
export function NetworkBoard({ data, onAct, youLabel = "You" }: { data: ConnectionsResponse; onAct: Act; youLabel?: string }) {
  return (
    <div className="space-y-12">
      <section aria-labelledby="graph-h" className="reveal rounded-[22px] bg-white p-3 shadow-[0_0_0_1px_rgba(15,15,14,.08)] sm:p-6">
        <h2 id="graph-h" className="sr-only">Your network as a graph</h2>
        {data.connected.length === 0 && (
          <p className="px-3 pt-3 text-[var(--muted)]">
            Your network is empty. Find people on the{" "}
            <Link href="/people" className="font-semibold underline">people page</Link> and send a few requests.
          </p>
        )}
        <NetworkGraph connected={data.connected} youLabel={youLabel} />
      </section>

      {data.incoming.length > 0 && (
        <section aria-labelledby="in-h" className="reveal">
          <h2 id="in-h" className="text-2xl font-black uppercase tracking-tight">
            Waiting on you <span className="ml-2 rounded-full bg-[var(--yellow)] px-3 py-0.5 text-base">{data.incoming.length}</span>
          </h2>
          <ul className="mt-3 divide-y divide-[var(--ink)]/10 rounded-[22px] bg-white px-5">
            {data.incoming.map((i) => (
              <Row key={i.id} item={i}>
                <button type="button" onClick={() => onAct(i.id, "accept")} className={`${btn} bg-[var(--ink)] text-white`}>Accept</button>
                <button type="button" onClick={() => onAct(i.id, "decline")} className={`${btn} border border-[var(--ink)]`}>Decline quietly</button>
              </Row>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="all-h" className="reveal">
        <h2 id="all-h" className="text-2xl font-black uppercase tracking-tight">Connections</h2>
        {data.connected.length === 0 ? (
          <p className="mt-3 rounded-[22px] bg-white p-5 text-[var(--muted)]">Nobody yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--ink)]/10 rounded-[22px] bg-white px-5">
            {data.connected.map((c) => (
              <Row key={c.id} item={c}>
                <button type="button" onClick={() => onAct(c.id, "remove")} className={`${btn} border border-[var(--ink)]/30 text-[var(--muted)]`}>Remove</button>
              </Row>
            ))}
          </ul>
        )}
      </section>

      {data.outgoing.length > 0 && (
        <section aria-labelledby="out-h" className="reveal">
          <h2 id="out-h" className="text-2xl font-black uppercase tracking-tight">Sent by you</h2>
          <ul className="mt-3 divide-y divide-[var(--ink)]/10 rounded-[22px] bg-white px-5">
            {data.outgoing.map((o) => (
              <Row key={o.id} item={o}>
                <button type="button" onClick={() => onAct(o.id, "remove")} className={`${btn} border border-[var(--ink)]/30 text-[var(--muted)]`}>Withdraw</button>
              </Row>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
