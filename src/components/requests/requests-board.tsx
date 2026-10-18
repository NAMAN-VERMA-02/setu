import type { AsksResponse } from "@/lib/asks/types";
import { ReceivedCard, SentCard, type OnAction } from "./request-card";

/** Presentational inbox: what is waiting on me, and what I have sent. */
export function RequestsBoard({
  data,
  onAction,
  onChanged,
}: {
  data: AsksResponse;
  onAction: OnAction;
  onChanged: () => void;
}) {
  const open = data.received.filter((a) => a.status !== "cancelled" && a.status !== "expired");

  return (
    <div className="space-y-12">
      <section aria-labelledby="inbox-h">
        <h2 id="inbox-h" className="mb-4 text-2xl font-black uppercase tracking-tight">
          Waiting on you
          {open.length > 0 && <span className="ml-2 rounded-full bg-[var(--yellow)] px-3 py-0.5 text-base">{open.length}</span>}
        </h2>
        {data.received.length === 0 ? (
          <p className="rounded-[22px] bg-white p-5 text-[var(--muted)]">
            Nothing yet. When a junior asks for your advice, it shows up here.
          </p>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {data.received.map((a) => (
              <ReceivedCard key={a.id} ask={a} onAction={onAction} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sent-h">
        <h2 id="sent-h" className="mb-4 text-2xl font-black uppercase tracking-tight">
          Your requests
        </h2>
        {data.sent.length === 0 ? (
          <p className="rounded-[22px] bg-white p-5 text-[var(--muted)]">
            You have not asked anyone yet. Find seniors who were where you are in your matches.
          </p>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {data.sent.map((a) => (
              <SentCard key={a.id} ask={a} onAction={onAction} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
