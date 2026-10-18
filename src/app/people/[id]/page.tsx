import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ConnectButton } from "@/components/people/connect-button";
import { VouchPanel, type VouchItem } from "@/components/people/vouch-panel";
import type { ConnState } from "@/lib/connections/types";
import { createClient } from "@/lib/supabase/server";
import { INTENT_LABELS, OPEN_TO_LABELS, type OpenTo } from "@/lib/validation/profile";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Person({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // the session check reads the clock, so render per request
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Row security only returns people from the viewer's own college.
  const { data: p } = await supabase
    .from("users")
    .select("id, full_name, role, batch, branch, headline, bio, location, current_company, current_title, expertise, open_to, details, college_email_verified")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const isMe = p.id === user.id;
  const isStudent = p.role === "student";
  const [{ data: vouchRows }, { data: canVouch }] = await Promise.all([
    isStudent
      ? supabase.from("vouches").select("id, voucher_id, skill, note").eq("student_id", id).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] as { id: string; voucher_id: string; skill: string; note: string | null }[] }),
    isStudent && !isMe ? supabase.rpc("can_vouch", { p_student: id }) : Promise.resolve({ data: false }),
  ]);
  const voucherIds = [...new Set((vouchRows ?? []).map((v) => v.voucher_id))];
  const { data: voucherUsers } = voucherIds.length
    ? await supabase.from("users").select("id, full_name, role, current_company").in("id", voucherIds)
    : { data: [] as { id: string; full_name: string; role: string; current_company: string | null }[] };
  const voucherOf = new Map((voucherUsers ?? []).map((u) => [u.id, u]));
  const vouchItems: VouchItem[] = (vouchRows ?? []).map((v) => {
    const u = voucherOf.get(v.voucher_id);
    return { id: v.id, skill: v.skill, note: v.note, mine: v.voucher_id === user.id, voucher: u ? { id: u.id, name: u.full_name, role: u.role, company: u.current_company } : null };
  });

  const [{ data: intents }, { data: conn }, { data: mutual }] = await Promise.all([
    supabase.from("intents").select("kind, category, statement").eq("user_id", id).eq("active", true).order("created_at"),
    isMe
      ? Promise.resolve({ data: null })
      : supabase.from("connections").select("requester_id, status").or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`).maybeSingle(),
    isMe ? Promise.resolve({ data: 0 }) : supabase.rpc("mutual_count", { p_other: id }),
  ]);

  const state: ConnState = !conn ? "none" : conn.status === "accepted" ? "connected" : conn.requester_id === user.id ? "pending_out" : "pending_in";
  const d = (p.details ?? {}) as Record<string, string>;
  const extras = [
    d.stage && ["Stage", d.stage],
    d.problems && ["Problems they are solving", d.problems],
    d.lab && ["Lab or department", d.lab],
    d.hiring_focus && ["Hiring", d.hiring_focus],
  ].filter(Boolean) as [string, string][];

  return (
    <PageShell
      eyebrow={`${p.role}${p.college_email_verified ? " · college email verified" : ""}`}
      title={[p.full_name.replace(/\s*\(.*?\)\s*/g, " ").trim()]}
      lede={p.headline ?? [p.current_title, p.current_company].filter(Boolean).join(" at ") ?? undefined}
    >
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          {p.bio && <p className="whitespace-pre-wrap text-lg">{p.bio}</p>}

          {(p.expertise ?? []).length > 0 && (
            <section aria-labelledby="exp-h">
              <h2 id="exp-h" className="mb-3 text-2xl font-black uppercase tracking-tight">Knows</h2>
              <ul className="flex flex-wrap gap-2">
                {(p.expertise as string[]).map((e) => (
                  <li key={e} className="rounded-full bg-white px-4 py-1.5 text-sm font-medium shadow-[0_0_0_1px_rgba(15,15,14,.08)]">{e}</li>
                ))}
              </ul>
            </section>
          )}

          {isStudent && <VouchPanel studentId={p.id} initial={vouchItems} canVouch={Boolean(canVouch)} />}

          {(intents ?? []).length > 0 && (
            <section aria-labelledby="int-h">
              <h2 id="int-h" className="mb-3 text-2xl font-black uppercase tracking-tight">Intent</h2>
              <ul className="space-y-2">
                {(intents ?? []).map((i, idx) => (
                  <li key={idx} className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
                    <span className="mr-2 rounded-full bg-[var(--yellow)] px-3 py-0.5 text-xs font-bold uppercase">{i.kind === "offer" ? "Offers" : "Looking for"}</span>
                    <span className="text-xs text-[var(--muted)]">{INTENT_LABELS[i.category as keyof typeof INTENT_LABELS] ?? i.category}</span>
                    <p className="mt-1">{i.statement}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {extras.map(([k, v]) => (
            <section key={k}>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{k}</h2>
              <p>{v}</p>
            </section>
          ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[22px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,14,.08)]">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Branch</dt><dd className="font-semibold">{p.branch}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Batch</dt><dd className="font-semibold">{p.batch}</dd></div>
              {p.location && <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Based in</dt><dd className="font-semibold">{p.location}</dd></div>}
              {!isMe && <div className="flex justify-between gap-4"><dt className="text-[var(--muted)]">Mutual connections</dt><dd className="font-semibold">{(mutual as number) ?? 0}</dd></div>}
            </dl>
            {(p.open_to ?? []).length > 0 && (
              <p className="mt-4 text-sm">
                <span className="font-semibold">Open to:</span> {(p.open_to as OpenTo[]).map((o) => OPEN_TO_LABELS[o] ?? o).join(", ")}
              </p>
            )}
            <div className="mt-5">
              {isMe ? (
                <Link href="/profile" className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white">Edit your profile</Link>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <ConnectButton userId={p.id} initial={state} />
                  {state === "connected" && (
                    <Link href={`/messages?with=${p.id}`} className="rounded-full border border-[var(--ink)] px-5 py-2 text-sm font-semibold transition-colors hover:bg-[var(--ink)] hover:text-white">
                      Message
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense>
      <Person params={params} />
    </Suspense>
  );
}
