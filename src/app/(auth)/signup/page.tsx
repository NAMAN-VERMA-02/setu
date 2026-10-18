import { Suspense } from "react";
import Link from "next/link";
import { signup } from "../actions";
import { AuthForm, Field } from "../form";
import { InviteFields, Standard } from "./invite-fields";

export const metadata = { title: "Join SETU" };

export default function SignupPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  return (
    <>
      <h1 className="text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl">Join SETU</h1>
      <p className="mb-6 mt-2 text-[var(--muted)]">Use your college email, or the invite you were sent. You must be 18 or older.</p>

      <AuthForm action={signup} submitLabel="Create account">
        <Field label="Full name" name="fullName" autoComplete="name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <Suspense fallback={<Standard />}>
          <InviteFields searchParams={searchParams} />
        </Suspense>
        <Field label="Date of birth" name="dob" type="date" autoComplete="bday" required />
      </AuthForm>

      <p className="mt-6 text-sm">
        Already a member?{" "}
        <Link href="/login" className="font-semibold underline">
          Log in
        </Link>
      </p>
    </>
  );
}
