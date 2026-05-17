"use client";

import { useActionState } from "react";

import { signUpAction } from "@/features/auth/actions";
import type { SignUpState } from "@/features/auth/schemas";

const initialState: SignUpState = {};

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <label className="grid gap-2 text-sm font-medium">
        Nombre
        <input
          autoComplete="name"
          className="min-h-12 rounded-lg border border-border bg-background px-4 text-base outline-none transition focus:border-primary"
          name="name"
          required
          type="text"
        />
        {state.fieldErrors?.name ? (
          <span className="text-sm text-red-600">
            {state.fieldErrors.name[0]}
          </span>
        ) : null}
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="min-h-12 rounded-lg border border-border bg-background px-4 text-base outline-none transition focus:border-primary"
          name="email"
          required
          type="email"
        />
        {state.fieldErrors?.email ? (
          <span className="text-sm text-red-600">
            {state.fieldErrors.email[0]}
          </span>
        ) : null}
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Contraseña
        <input
          autoComplete="new-password"
          className="min-h-12 rounded-lg border border-border bg-background px-4 text-base outline-none transition focus:border-primary"
          minLength={8}
          name="password"
          required
          type="password"
        />
        {state.fieldErrors?.password ? (
          <span className="text-sm text-red-600">
            {state.fieldErrors.password[0]}
          </span>
        ) : null}
      </label>

      <button
        className="min-h-12 rounded-lg bg-primary px-4 text-base font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
}
