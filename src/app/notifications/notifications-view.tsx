"use client";

import { useEffect, useState } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import { useLive } from "@/lib/live/use-live";
import type { NotificationItem } from "@/lib/notifications/types";

const refreshBadge = () => window.dispatchEvent(new Event("setu:badge-refresh"));

export function NotificationsView() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [tick, setTick] = useState(0); // bumps when a live change arrives, which refetches
  useLive(() => setTick((t) => t + 1));

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/notifications");
      const body = await res.json().catch(() => null);
      if (!alive) return;
      if (res.ok && body) {
        setItems(body.notifications);
        setEmailDigest(body.emailDigest);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  async function markAll() {
    const res = await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (res.ok) {
      setItems((cur) => cur.map((n) => ({ ...n, read: true })));
      refreshBadge();
    }
  }

  async function open(item: NotificationItem) {
    if (item.read) return;
    setItems((cur) => cur.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [item.id] }) });
    refreshBadge();
  }

  async function digest(on: boolean) {
    setEmailDigest(on);
    const res = await fetch("/api/notifications/digest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on }) });
    if (!res.ok) setEmailDigest(!on);
  }

  return <NotificationList items={items} loading={loading} emailDigest={emailDigest} onMarkAll={markAll} onOpen={open} onDigest={digest} />;
}
