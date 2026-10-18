import { ROLES } from "@/lib/validation/auth";
import { createClient } from "@/lib/supabase/server";
import { Field, SelectField } from "../form";

/** The role, branch and batch fields, or an invite banner when the visitor arrived with a valid invite. */
export async function InviteFields({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  const code = (invite ?? "").trim().toLowerCase();

  if (/^[a-f0-9]{12}$/.test(code)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("check_invite", { p_code: code });
    const found = data?.[0] as { role: string; college_name: string } | undefined;
    if (found) {
      return (
        <>
          <input type="hidden" name="inviteCode" value={code} />
          <p role="status" className="rounded-xl bg-[var(--blue)]/40 p-3 text-sm">
            You were invited to join <strong>{found.college_name}</strong> as a <strong>{found.role}</strong>. Use any email you can open; we will send a confirmation link.
          </p>
        </>
      );
    }
    return (
      <>
        <p role="alert" className="rounded-xl bg-[var(--red-tile)]/15 p-3 text-sm">
          That invite is not valid any more. Ask the person who sent it for a new one, or join with your college email below.
        </p>
        <Standard />
      </>
    );
  }
  return <Standard />;
}

export function Standard() {
  return (
    <>
      <SelectField label="I am a" name="role" options={ROLES} defaultValue="student" required />
      <Field label="Branch" name="branch" required />
      <Field label="Batch (graduation year)" name="batch" type="number" inputMode="numeric" min={1990} max={2100} required />
    </>
  );
}
