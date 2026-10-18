"use client";

import { useState } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import type { NotificationItem } from "@/lib/notifications/types";

const seed: NotificationItem[] = [
  { id: "1", kind: "vouch", title: "Amit Sharma vouched for your React", link: "/people/a1", createdAt: "2026-10-17T09:40:00Z", read: false },
  { id: "2", kind: "connection_request", title: "Isha Pandey wants to connect", link: "/network", createdAt: "2026-10-17T08:00:00Z", read: false },
  { id: "3", kind: "announcement", title: "Event: Alumni meet on 2 November", link: "/announcements", createdAt: "2026-10-16T12:00:00Z", read: true },
  { id: "4", kind: "ask", title: "A student sent you a request", link: "/requests", createdAt: "2026-10-14T12:00:00Z", read: true },
];

export function NotificationsPreview() {
  const [items, setItems] = useState(seed);
  const [digest, setDigest] = useState(true);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-5xl font-black uppercase tracking-tight">Updates preview</h1>
      <NotificationList
        items={items}
        emailDigest={digest}
        onMarkAll={() => setItems((c) => c.map((n) => ({ ...n, read: true })))}
        onOpen={(i) => setItems((c) => c.map((n) => (n.id === i.id ? { ...n, read: true } : n)))}
        onDigest={setDigest}
      />
    </main>
  );
}
