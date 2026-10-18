import { NextResponse, type NextRequest } from "next/server";
import type { ConnItem, ConnPerson, ConnectionsResponse } from "@/lib/connections/types";
import { createClient } from "@/lib/supabase/server";
import { connectSchema } from "@/lib/validation/connections";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** My network: people I am connected to, requests waiting on me, and requests I sent. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const [{ data: rows, error }, { data: declines }] = await Promise.all([
    supabase.from("connections").select("id, requester_id, addressee_id, status, message, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("connection_declines").select("connection_id").eq("declined_by", user.id),
  ]);
  if (error) return fail("We could not load your network.", 500);

  const declined = new Set((declines ?? []).map((d) => d.connection_id as string));
  const visible = (rows ?? []).filter((r) => !declined.has(r.id));
  const otherIds = [...new Set(visible.map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id) as string))];
  const { data: people } = otherIds.length
    ? await supabase.from("users").select("id, full_name, role, headline, batch, branch, current_company").in("id", otherIds)
    : { data: [] as { id: string; full_name: string; role: string; headline: string | null; batch: number; branch: string; current_company: string | null }[] };
  const personOf = new Map<string, ConnPerson>(
    (people ?? []).map((p) => [p.id, { id: p.id, name: p.full_name, role: p.role, headline: p.headline, batch: p.batch, branch: p.branch, company: p.current_company }]),
  );

  const out: ConnectionsResponse = { connected: [], incoming: [], outgoing: [] };
  for (const r of visible) {
    const mine = r.requester_id === user.id;
    const person = personOf.get((mine ? r.addressee_id : r.requester_id) as string);
    if (!person) continue;
    const item: ConnItem = { id: r.id, person, message: r.message, createdAt: r.created_at };
    if (r.status === "accepted") out.connected.push(item);
    else if (mine) out.outgoing.push(item);
    else out.incoming.push(item);
  }
  return NextResponse.json(out);
}

/** Ask to connect. If they already asked you, this accepts their request instead. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const parsed = connectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Choose someone to connect with.", 400);
  const { userId, message } = parsed.data;
  if (userId === user.id) return fail("You cannot connect with yourself.", 400);

  const { data: existing } = await supabase
    .from("connections")
    .select("id, requester_id, status")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`)
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return fail("You are already connected.", 409);
    if (existing.requester_id === user.id) return fail("Your request is already waiting.", 409);
    const { error } = await supabase.from("connections").update({ status: "accepted" }).eq("id", existing.id);
    return error ? fail("We could not accept that.", 400) : NextResponse.json({ ok: true, state: "connected" });
  }

  const { error } = await supabase.from("connections").insert({ requester_id: user.id, addressee_id: userId, message: message || null });
  if (error) {
    if (/too many pending/.test(error.message)) return fail("You have a lot of requests waiting. Give people time to answer.", 429);
    if (/college/.test(error.message)) return fail("You can only connect with people from your college.", 422);
    return fail("We could not send that. Please try again.", 400);
  }
  return NextResponse.json({ ok: true, state: "pending_out" }, { status: 201 });
}
