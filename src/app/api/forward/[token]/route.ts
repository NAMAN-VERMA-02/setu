import { NextResponse, type NextRequest } from "next/server";
import { lookupForward, replyToForward } from "@/lib/asks/forward";
import { replySchema } from "@/lib/validation/asks";

// Public: whoever holds the link can read the request and reply, with no sign-up.
// Unknown, malformed and expired links all look the same.
const gone = () => NextResponse.json({ error: "This link is not valid any more." }, { status: 404 });

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/forward/[token]">) {
  const { token } = await ctx.params;
  const view = await lookupForward(token);
  if (!view) return gone();
  return NextResponse.json({
    askerFirstName: view.asker_first_name,
    goal: view.goal,
    targetCompany: view.target_company,
    message: view.message,
    workUrl: view.work_url,
    expiresAt: view.expires_at,
    replied: view.status === "replied",
  });
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/forward/[token]">) {
  const { token } = await ctx.params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is a plain one-tap reply.
  }
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Keep the note under 500 characters." }, { status: 400 });

  const ok = await replyToForward(token, parsed.data.note);
  return ok ? NextResponse.json({ ok: true }) : gone();
}
