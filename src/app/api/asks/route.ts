import { NextResponse, type NextRequest } from "next/server";
import { mapDbError } from "@/lib/asks/errors";
import { isExpired } from "@/lib/asks/trust";
import { createClient } from "@/lib/supabase/server";
import { createAskSchema } from "@/lib/validation/asks";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Start a request: a direct question to a senior, or a bridge request through one. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Send a JSON body.", 400);
  }
  const parsed = createAskSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your request.", 400);
  const input = parsed.data;

  // Give to get: nobody can ask for help before sharing their own journey.
  const { count } = await supabase
    .from("snapshots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!count) return fail("Share your journey before asking for help.", 403);

  // The first ask is only ever a question; the database enforces this too.
  const row =
    input.kind === "direct"
      ? { asker_id: user.id, target_id: input.targetId, message: input.message }
      : { asker_id: user.id, via_id: input.viaId, target_company: input.targetCompany, message: input.message };

  const { data, error } = await supabase
    .from("asks")
    .insert({ ...row, trust_step: "question", status: "pending" })
    .select("id, trust_step, status, expires_at")
    .single();
  if (error) {
    const mapped = mapDbError(error.message);
    return fail(mapped.error, mapped.status);
  }
  return NextResponse.json({ ask: data }, { status: 201 });
}

/** Everything I sent and everything waiting on me. Declined requests never show up here. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const [{ data: asks, error }, { data: declines }] = await Promise.all([
    supabase.from("asks").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("ask_declines").select("ask_id").eq("declined_by", user.id),
  ]);
  if (error) return fail("We could not load your requests.", 500);

  const declined = new Set((declines ?? []).map((d) => d.ask_id as string));
  const rows = (asks ?? []).filter((a) => !declined.has(a.id));

  const peopleIds = [...new Set(rows.flatMap((a) => [a.asker_id, a.target_id, a.via_id]).filter(Boolean))] as string[];
  const { data: people } = peopleIds.length
    ? await supabase.from("users").select("id, full_name").in("id", peopleIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const shape = (a: (typeof rows)[number]) => ({
    id: a.id,
    kind: a.via_id ? "bridge" : "direct",
    trustStep: a.trust_step,
    // A senior's silent decline is never reflected here, so a declined ask just keeps waiting.
    status: isExpired(a.expires_at) ? "expired" : a.status,
    message: a.message,
    targetCompany: a.target_company,
    workUrl: a.work_url,
    workSeen: Boolean(a.work_seen_at),
    forwarded: Boolean(a.forward_token_hash),
    repliedAt: a.replied_at,
    replyNote: a.reply_note,
    expiresAt: a.expires_at,
    createdAt: a.created_at,
  });

  const sent = rows
    .filter((a) => a.asker_id === user.id)
    .map((a) => {
      const other = a.via_id ?? a.target_id;
      return { ...shape(a), counterpart: { id: other, name: nameOf.get(other) ?? null } };
    });
  const received = rows
    .filter((a) => a.asker_id !== user.id)
    .map((a) => ({
      ...shape(a),
      role: a.via_id === user.id ? "via" : "target",
      counterpart: { id: a.asker_id, name: nameOf.get(a.asker_id) ?? null },
    }));

  return NextResponse.json({ sent, received });
}
