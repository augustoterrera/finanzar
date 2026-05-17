import Link from "next/link";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function SignUpPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto grid w-full max-w-sm gap-8">
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-primary">Finanzar</p>
          <h1 className="text-3xl font-bold tracking-normal">Crear cuenta</h1>
          <p className="text-muted">
            Te creamos un workspace personal para arrancar.
          </p>
        </div>

        <SignUpForm />

        <p className="text-center text-sm text-muted">
          ¿Ya tenés cuenta?{" "}
          <Link className="font-semibold text-primary" href="/sign-in">
            Ingresar
          </Link>
        </p>
      </div>
    </main>
  );
}
