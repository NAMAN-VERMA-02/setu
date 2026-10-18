"use client";

import { useCallback, useEffect, useState } from "react";
import { ImportBoard, type ImportedPerson } from "@/components/college/import-board";
import type { ImportRow } from "@/lib/college/csv";

export function ImportView({ siteUrl }: { siteUrl: string }) {
  const [people, setPeople] = useState<ImportedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const origin = siteUrl || (typeof window === "undefined" ? "" : window.location.origin);

  const load = useCallback(async () => {
    const res = await fetch("/api/college/import");
    if (res.status === 403) setDenied(true);
    const body = await res.json().catch(() => null);
    if (res.ok && body?.people) setPeople(body.people);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/college/import");
      const body = await res.json().catch(() => null);
      if (!alive) return;
      if (res.status === 403) setDenied(true);
      if (res.ok && body?.people) setPeople(body.people);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function importRows(rows: ImportRow[]) {
    const res = await fetch("/api/college/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error ?? "We could not import that list." };
    await load();
    return { added: body.added as number, skipped: body.skipped as number };
  }

  if (denied) return <p className="rounded-[22px] bg-white p-6">This page is for your college&apos;s placement cell.</p>;
  return <ImportBoard people={people} loading={loading} siteUrl={origin} onImport={importRows} />;
}
