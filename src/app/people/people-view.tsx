"use client";

import { useEffect, useState } from "react";
import { ConnectButton } from "@/components/people/connect-button";
import { PeopleList } from "@/components/people/people-list";
import { useLive } from "@/lib/live/use-live";
import type { PeopleResponse } from "@/lib/people/types";

export function PeopleView() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("");
  const [openTo, setOpenTo] = useState("");
  const [data, setData] = useState<PeopleResponse | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0); // bumps when a live change arrives, which refetches
  useLive(() => setTick((t) => t + 1));

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(q), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams();
        if (debounced.trim()) params.set("q", debounced.trim());
        if (role) params.set("role", role);
        if (openTo) params.set("openTo", openTo);
        const res = await fetch(`/api/people?${params}`, { signal: controller.signal });
        const json = await res.json();
        if (res.ok) {
          setData(json);
          setError("");
        } else setError(json.error ?? "Could not search.");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Could not reach SETU. Check your connection and try again.");
      }
    })();
    return () => controller.abort();
  }, [debounced, role, openTo, tick]);

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-white p-4 text-[var(--red)]">
          {error}
        </p>
      )}
      <PeopleList people={data?.people ?? []} loading={data === null} q={q} role={role} openTo={openTo} onQuery={setQ} onRole={setRole} onOpenTo={setOpenTo}
        action={(p) => <ConnectButton key={p.id} userId={p.id} initial={p.connection} />}
      />
    </>
  );
}
