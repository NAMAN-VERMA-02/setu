"use client";

import { createContext, useActionState, useContext } from "react";
import type { AuthFormState } from "@/lib/validation/auth";

type Action = (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;

const ErrorsContext = createContext<AuthFormState["errors"]>(undefined);

const controlClass =
  "w-full rounded-xl border border-[var(--ink)]/20 bg-white px-4 py-3 text-base text-[var(--ink)] outline-none focus:border-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]";

function FieldShell({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: (a11y: { "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const errors = useContext(ErrorsContext)?.[name];
  const errorId = `${name}-error`;
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children(errors ? { "aria-invalid": true, "aria-describedby": errorId } : {})}
      {errors && (
        <p id={errorId} className="mt-1 text-sm text-[var(--red)]">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} name={name}>
      {(a11y) => <input id={name} name={name} className={controlClass} {...a11y} {...props} />}
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  options,
  ...props
}: {
  label: string;
  name: string;
  options: readonly string[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} name={name}>
      {(a11y) => (
        <select id={name} name={name} className={`${controlClass} capitalize`} {...a11y} {...props}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: Action;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.ok) {
    return (
      <p role="status" className="rounded-xl bg-[var(--blue)]/40 p-4 text-base">
        {state.message}
      </p>
    );
  }

  return (
    <ErrorsContext.Provider value={state.errors}>
      <form action={formAction} className="space-y-4" noValidate>
        {children}
        {state.message && (
          <p role="alert" className="text-sm text-[var(--red)]">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-[var(--ink)] px-6 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Please wait…" : submitLabel}
        </button>
      </form>
    </ErrorsContext.Provider>
  );
}
