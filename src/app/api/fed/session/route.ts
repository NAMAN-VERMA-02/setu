import { connection } from "next/server";
import { loadDirectory, getSession, ok, publicCard, viewerTokensFor } from "@/lib/fed/server";
import { fedDb } from "@/lib/fed/db";

/** Who this browser is on the Live Network, with what it needs to read names from the colleges. */
export async function GET() {
  await connection();
  const session = await getSession();
  if (!session) return ok({ session: null });
  const dir = await loadDirectory();
  const me = dir.get(session.pid);
  if (!me) return ok({ session: null });

  const { data: ledger } = await fedDb().from("fed_leaderboard").select("points, karz, score").eq("pid", session.pid).maybeSingle();
  return ok({
    session: { ...publicCard(me), storyKey: me.story_key, demoPersona: !!me.story_key },
    ledger: ledger ?? { points: 0, karz: 0, score: 0 },
    viewer: viewerTokensFor(session.pid),
  });
}
