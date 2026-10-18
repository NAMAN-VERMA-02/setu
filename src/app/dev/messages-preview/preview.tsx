"use client";

import { useState } from "react";
import { MessagesBoard } from "@/components/messages/messages-board";
import type { MessageItem, ThreadItem } from "@/lib/messages/types";

const threads: ThreadItem[] = [
  { id: "t1", other: { id: "a1", name: "Amit Sharma (sample)", role: "alumni", headline: "Software Engineer at Zoho" }, preview: "Happy to look at it this weekend.", lastMessageAt: "2026-10-16T10:00:00Z", unread: true },
  { id: "t2", other: { id: "f1", name: "Dr. Meera Jain (sample)", role: "faculty", headline: "Professor, Machine Learning" }, preview: "Send me the abstract.", lastMessageAt: "2026-10-15T10:00:00Z", unread: false },
];
const seed: MessageItem[] = [
  { id: "m1", senderId: "me", body: "Hi Amit, which GATE resources worked for you in the last two months?", createdAt: "2026-10-16T09:00:00Z" },
  { id: "m2", senderId: "a1", body: "Previous papers first, then one mock a week. Happy to look at it this weekend.", createdAt: "2026-10-16T10:00:00Z" },
];

export function MessagesPreview() {
  const [active, setActive] = useState<string | null>("t1");
  const [messages, setMessages] = useState(seed);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-5xl font-black uppercase tracking-tight">Messages preview</h1>
      <MessagesBoard
        threads={threads}
        activeId={active}
        messages={active === "t1" ? messages : []}
        meId="me"
        onOpen={(id) => setActive(id || null)}
        onSend={async (body) => {
          setMessages((m) => [...m, { id: `n${m.length}`, senderId: "me", body, createdAt: new Date().toISOString() }]);
          return null;
        }}
      />
    </main>
  );
}
