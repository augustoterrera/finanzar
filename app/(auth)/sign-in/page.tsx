import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/features/auth/components/sign-in-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function SignInPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto grid w-full max-w-sm gap-8">
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-primary">Finanzar</p>
          <h1 className="text-3xl font-bold tracking-normal">Ingresá</h1>
          <p className="text-muted">
            Controlá tus finanzas, tarjetas y proyectos desde tu espacio.
          </p>
        </div>

        <SignInForm />

        <p className="text-center text-sm text-muted">
          ¿No tenés cuenta?{" "}
          <Link className="font-semibold text-primary" href="/sign-up">
            Crear cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}
