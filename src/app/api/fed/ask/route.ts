import { z } from "zod";
import { ask } from "@/lib/fed/ask";
import { fail, loadDirectory, ok, cardLabel } from "@/lib/fed/server";

const body = z.object({ question: z.string().trim().min(2).max(300) });

/** Ask Setu over MCP. Returns the answer, the tool-call trace (shown on screen) and pseudonymous cards. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Ask a short question.", 400);
  const result = await ask(parsed.data.question);
  const dir = await loadDirectory();
  return ok({
    ...result,
    cards: result.cards.map((c) => {
      const d = dir.get(c.pid);
      return { ...c, label: d ? cardLabel(d) : `${c.node.toUpperCase()} alum` };
    }),
  });
}
