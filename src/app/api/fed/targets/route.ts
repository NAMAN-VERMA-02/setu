import { connection } from "next/server";
import { fedDb } from "@/lib/fed/db";
import { ok, offlineNodeIds, publicCard, type DirRow } from "@/lib/fed/server";

/** Search public job cards (title + company, no names) of people who are open to intros. */
export async function GET(req: Request) {
  await connection();
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 60).replace(/[%,()]/g, " ");
  const pid = (params.get("pid") ?? "").trim();
  const offline = await offlineNodeIds();
  let query = fedDb().from("fed_directory").select("*").in("role", ["alum", "professional", "faculty"]).eq("open_to_intros", true).limit(40);
  if (/^[a-z]+_[0-9a-f]{12}$/.test(pid)) query = query.eq("pid", pid); // a specific person, for links from Mirror, Find and Ask
  else if (q) query = query.or(`public_company.ilike.%${q}%,public_title.ilike.%${q}%`);
  const { data } = await query;
  const rows = ((data ?? []) as DirRow[])
    .map((d) => ({ ...publicCard(d), offline: offline.has(d.node_id) }))
    // hiring managers and seniors at the searched company first
    .sort((a, b) => Number(a.offline) - Number(b.offline) || (b.title?.includes("Manager") ? 1 : 0) - (a.title?.includes("Manager") ? 1 : 0));
  return ok({ targets: rows });
}
