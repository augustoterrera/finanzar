"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const wasRegistered = searchParams.get("registered") === "1";

  function onSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });

      if (result?.error) {
        setError("Email o contraseña incorrectos.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4">
      {wasRegistered ? (
        <p className="rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
          Cuenta creada. Iniciá sesión para continuar.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <label className="grid gap-2 text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="min-h-12 rounded-lg border border-border bg-background px-4 text-base outline-none transition focus:border-primary"
          name="email"
          required
          type="email"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Contraseña
        <input
          autoComplete="current-password"
          className="min-h-12 rounded-lg border border-border bg-background px-4 text-base outline-none transition focus:border-primary"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>

      <button
        className="min-h-12 rounded-lg bg-primary px-4 text-base font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
