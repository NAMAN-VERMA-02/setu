"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { createAsk } from "@/lib/asks/client";

type Props = {
  matchId: string;
  name: string;
  firstLine: string;
  /** Present when this senior can pass the request on to people at the student's target company. */
  bridge?: { company: string; contactCount: number };
  bridgeBlocked: boolean;
  /** Preview mode: pretend to send, never call the API. */
  demo?: boolean;
};

const textarea =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-3 py-2 text-base outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";

export function AskPanel({ matchId, name, firstLine, bridge, bridgeBlocked, demo }: Props) {
  const uid = useId();
  const canBridge = Boolean(bridge) && !bridgeBlocked;
  const firstName = name.split(" ")[0];

  const [open, setOpen] = useState(false);
  const [route, setRoute] = useState<"direct" | "bridge">("direct");
  const [message, setMessage] = useState(`${firstLine}\n\nI would really value your advice on one question: `);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    const body =
      route === "bridge" && bridge
        ? { kind: "bridge", viaId: matchId, targetCompany: bridge.company, message }
        : { kind: "direct", targetId: matchId, message };
    const result = demo ? { ok: true } : await createAsk(body);
    if (result.ok) {
      setState("sent");
    } else {
      setState("idle");
      setError(result.error ?? "Could not send your request.");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="mt-4 rounded-xl bg-[var(--blue)]/40 p-3 text-sm">
        Sent to {firstName}. {route === "bridge" ? "They can pass it on to someone they know. " : ""}
        <Link href="/requests" className="font-semibold underline">
          Follow it in Requests
        </Link>
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white"
      >
        Ask {firstName}
      </button>
    );
  }

  return (
    <form onSubmit={send} className="mt-4 space-y-3 rounded-2xl bg-[var(--paper)] p-4">
      <p className="text-sm text-[var(--muted)]">
        Your first ask is one question. A call, a small task and a referral come later, if they want to go further.
      </p>

      {canBridge && bridge && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">How do you want to reach out?</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name={`route-${uid}`} checked={route === "direct"} onChange={() => setRoute("direct")} className="mt-1" />
            <span>Ask {firstName} directly</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name={`route-${uid}`} checked={route === "bridge"} onChange={() => setRoute("bridge")} className="mt-1" />
            <span>
              Ask {firstName} to pass it on to someone at {bridge.company}
              <span className="block text-[var(--muted)]">
                They know {bridge.contactCount} people there. You only have one of these open at a time.
              </span>
            </span>
          </label>
        </fieldset>
      )}

      <div>
        <label htmlFor={`msg-${uid}`} className="mb-1 block text-sm font-medium">
          Your message
        </label>
        <textarea
          id={`msg-${uid}`}
          className={textarea}
          rows={5}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--red)]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={state === "sending" || message.trim().length === 0}
          className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-[var(--ink)] px-5 py-2 text-sm font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
