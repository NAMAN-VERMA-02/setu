"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessagesBoard } from "@/components/messages/messages-board";
import type { MessageItem, ThreadItem } from "@/lib/messages/types";
import { createClient } from "@/lib/supabase/client";

export function MessagesView({ meId }: { meId: string }) {
  const params = useSearchParams();
  const withUser = params.get("with");
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/messages/threads");
    const body = await res.json().catch(() => null);
    if (res.ok && body?.threads) setThreads(body.threads);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/messages/threads/${id}`);
    const body = await res.json().catch(() => null);
    if (res.ok && body?.messages) {
      setMessages(body.messages);
      window.dispatchEvent(new Event("setu:badge-refresh"));
    }
  }, []);

  // First load, and opening a thread from a profile (?with=<user id>).
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadThreads();
      if (!withUser || !alive) return;
      const res = await fetch("/api/messages/threads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: withUser }) });
      const body = await res.json().catch(() => null);
      if (!alive) return;
      if (!res.ok) return setError(body?.error ?? "We could not open that conversation.");
      await loadThreads();
      setActiveId(body.threadId);
      void loadMessages(body.threadId);
    })();
    return () => {
      alive = false;
    };
  }, [withUser, loadThreads, loadMessages]);

  function open(id: string | null) {
    setActiveId(id);
    setMessages([]);
    if (id) void loadMessages(id);
  }

  // New messages arrive live. Row security limits what Realtime sends to my own conversations.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("messages-board")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as { id: string; thread_id: string; sender_id: string; body: string; created_at: string };
        if (m.thread_id === activeId) {
          setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, { id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }]));
          if (m.sender_id !== meId) void fetch(`/api/messages/threads/${m.thread_id}`).then(() => window.dispatchEvent(new Event("setu:badge-refresh")));
        }
        void loadThreads();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, meId, loadThreads]);

  async function send(body: string): Promise<string | null> {
    if (!activeId) return "Choose a conversation.";
    const res = await fetch(`/api/messages/threads/${activeId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    const out = await res.json().catch(() => null);
    if (!res.ok) return out?.error ?? "We could not send that.";
    const m = out.message as MessageItem;
    setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
    void loadThreads();
    return null;
  }

  return <MessagesBoard threads={threads} activeId={activeId} messages={messages} meId={meId} loading={loading} error={error} onOpen={(id) => open(id || null)} onSend={send} />;
}
