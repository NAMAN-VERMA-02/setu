import { Suspense } from "react";
import Link from "next/link";
import { login } from "../actions";
import { AuthForm, Field } from "../form";

export const metadata = { title: "Log in" };

async function LinkError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return (
    <p role="alert" className="mb-4 rounded-xl bg-[var(--red-tile)]/15 p-3 text-sm">
      We could not finish setting up your account. Confirm with your college email and try again.
    </p>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <>
      <h1 className="text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl">Welcome back</h1>
      <p className="mb-6 mt-2 text-[var(--muted)]">Log in with your college email.</p>

      <Suspense>
        <LinkError searchParams={searchParams} />
      </Suspense>

      <AuthForm action={login} submitLabel="Log in">
        <Field label="College email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      </AuthForm>

      <p className="mt-6 text-sm">
        New here?{" "}
        <Link href="/signup" className="font-semibold underline">
          Join SETU
        </Link>
      </p>
    </>
  );
}
