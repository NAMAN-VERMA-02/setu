"use client";

import { useCallback, useEffect, useState } from "react";
import { AnnouncementBoard } from "@/components/college/announcement-board";
import { useLive } from "@/lib/live/use-live";
import type { AnnouncementInput, AnnouncementItem } from "@/lib/validation/announcements";

export function AnnouncementsView({ canPost }: { canPost: boolean }) {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/announcements");
    const body = await res.json().catch(() => null);
    if (res.ok && body?.announcements) setItems(body.announcements);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/announcements");
      const body = await res.json().catch(() => null);
      if (!alive) return;
      if (res.ok && body?.announcements) setItems(body.announcements);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);
  useLive(load);

  async function post(input: AnnouncementInput): Promise<string | null> {
    const res = await fetch("/api/announcements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return body.error ?? "We could not post that.";
    await load();
    return null;
  }

  async function remove(id: string) {
    const res = await fetch(`/api/announcements?id=${id}`, { method: "DELETE" });
    if (res.ok) setItems((cur) => cur.filter((a) => a.id !== id));
  }

  return <AnnouncementBoard items={items} loading={loading} canPost={canPost} onPost={post} onRemove={remove} />;
}
