import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildDigest } from "@/lib/digest/build";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_RECIPIENTS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
}

/**
 * The weekly digest. Vercel Cron calls this with the CRON_SECRET; nobody else can.
 * It sends nothing unless an email provider (Resend) is configured, skips sample accounts,
 * respects each person's opt-out and reports counts only, never addresses.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  if (!authorised(request)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM;
  if (!resendKey || !from) return NextResponse.json({ sent: 0, skipped: "no email provider configured" });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ sent: 0, skipped: "service key not configured" });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const { data: members } = await admin.from("users").select("id, full_name, college_id").eq("email_digest", true).limit(5000);
  const { data: opps } = await admin
    .from("opportunities")
    .select("title, company, kind, poster:users!poster_id(college_id)")
    .eq("status", "open")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const oppsByCollege = new Map<string, { title: string; company: string | null; kind: string }[]>();
  for (const o of opps ?? []) {
    const poster = o.poster as unknown as { college_id: string } | { college_id: string }[] | null;
    const college = Array.isArray(poster) ? poster[0]?.college_id : poster?.college_id;
    if (!college) continue;
    const list = oppsByCollege.get(college) ?? [];
    list.push({ title: o.title, company: o.company, kind: o.kind });
    oppsByCollege.set(college, list);
  }

  const emailOf = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emailOf.set(u.id, u.email);
    if ((data?.users ?? []).length < 1000) break;
  }

  let sent = 0;
  let failed = 0;
  for (const m of members ?? []) {
    if (sent + failed >= MAX_RECIPIENTS) break;
    const email = emailOf.get(m.id);
    if (!email || email.endsWith("@seed.invalid")) continue;

    const { data: unread } = await admin
      .from("notifications")
      .select("title")
      .eq("user_id", m.id)
      .is("read_at", null)
      .gte("created_at", new Date(Date.now() - 14 * DAY_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(30);
    const digest = buildDigest({ name: m.full_name, siteUrl, unread: (unread ?? []).map((n) => n.title), opportunities: oppsByCollege.get(m.college_id) ?? [] });
    if (!digest) continue;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: digest.subject, text: digest.text }),
    }).catch(() => null);
    if (res?.ok) sent += 1;
    else failed += 1;
  }
  return NextResponse.json({ sent, failed });
}
