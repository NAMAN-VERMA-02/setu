import { z } from "zod";
import { fedDb } from "@/lib/fed/db";
import { fail, ok, setSession } from "@/lib/fed/server";

const body = z.object({ story_key: z.string().min(2).max(30) });

/** Picks a demo persona. Story people are labelled "Demo persona" in the UI. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick a persona.", 400);
  const { data } = await fedDb().from("fed_directory").select("pid, node_id, story_key").eq("story_key", parsed.data.story_key).maybeSingle();
  if (!data) return fail("That persona is not available. Ask the presenter to reset the demo.", 404);
  await setSession({ pid: data.pid, node: data.node_id });
  return ok({ ok: true, pid: data.pid, node: data.node_id });
}
