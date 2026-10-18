"use client";

import { useState } from "react";
import { RequestsBoard } from "@/components/requests/requests-board";
import type { ActionResult, AsksResponse, ReceivedAsk, SentAsk } from "@/lib/asks/types";

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

const base = { workUrl: null, workSeen: false, forwarded: false, repliedAt: null, replyNote: null, createdAt: iso(-1) };

const initial: AsksResponse = {
  received: [
    {
      ...base,
      id: "r1",
      kind: "direct",
      role: "target",
      trustStep: "question",
      status: "pending",
      message: "You also had 1 backlog in semester 5.\n\nHow did you prepare for the Cognizant online test?",
      targetCompany: null,
      expiresAt: iso(6),
      counterpart: { id: "s1", name: "Priya Gupta (sample)" },
    } satisfies ReceivedAsk,
    {
      ...base,
      id: "r2",
      kind: "bridge",
      role: "via",
      trustStep: "question",
      status: "pending",
      message: "In semester 5 you were both aiming for a job. Could you pass this on to someone at Cognizant?",
      targetCompany: "Cognizant",
      expiresAt: iso(4),
      counterpart: { id: "s2", name: "Rohan Singh (sample)" },
    } satisfies ReceivedAsk,
    {
      ...base,
      id: "r3",
      kind: "direct",
      role: "target",
      trustStep: "task",
      status: "accepted",
      message: "Thanks for the call! Here is the small project you suggested.",
      targetCompany: null,
      workUrl: "https://github.com/example/demo",
      expiresAt: iso(3),
      counterpart: { id: "s3", name: "Kavya Jain (sample)" },
    } satisfies ReceivedAsk,
  ],
  sent: [
    {
      ...base,
      id: "s1",
      kind: "direct",
      trustStep: "call",
      status: "accepted",
      message: "How did you get ready for the DBMS viva?",
      targetCompany: null,
      expiresAt: iso(5),
      counterpart: { id: "a", name: "Amit Sharma (sample)" },
    } satisfies SentAsk,
    {
      ...base,
      id: "s2",
      kind: "bridge",
      trustStep: "question",
      status: "forwarded",
      message: "Could you pass this on to someone at Cognizant?",
      targetCompany: "Cognizant",
      forwarded: true,
      expiresAt: iso(2),
      counterpart: { id: "b", name: "Riya Verma (sample)" },
    } satisfies SentAsk,
    {
      ...base,
      id: "s3",
      kind: "direct",
      trustStep: "task",
      status: "accepted",
      message: "Happy to do a small task if it helps.",
      targetCompany: null,
      expiresAt: iso(6),
      counterpart: { id: "c", name: "Kabir Singh (sample)" },
    } satisfies SentAsk,
  ],
};

// Design preview: actions are simulated locally and never reach the API.
export function RequestsPreview() {
  const [data, setData] = useState(initial);

  async function onAction(id: string, body: Record<string, unknown>): Promise<ActionResult> {
    if (body.action === "forward") {
      return { ok: true, link: "https://setu.example/f/Qm9r8s2LxT0uVw7yZaB3cD4eF5gH6iJ7kL8mN9oP0qR", expiresAt: iso(4) };
    }
    if (body.action === "decline") {
      setData((d) => ({ ...d, received: d.received.filter((a) => a.id !== id) }));
    }
    return { ok: true };
  }

  return <RequestsBoard data={data} onAction={onAction} onChanged={() => {}} />;
}
