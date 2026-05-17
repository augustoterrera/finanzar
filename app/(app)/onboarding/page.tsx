import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";

import { Card } from "@/components/ui/card";
import { CreateAccountForm } from "@/features/accounts/components/create-account-form";
import { getActiveWorkspace } from "@/features/workspaces/queries";

export default async function OnboardingPage() {
  const activeWorkspace = await getActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/sign-in");
  }

  if (activeWorkspace.accountCount > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto grid min-h-[calc(100svh-8rem)] w-full max-w-md content-center gap-6">
      <div className="grid gap-3">
        <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-white">
          <Landmark aria-hidden="true" size={24} />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">
            {activeWorkspace.workspace.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold">Creá tu primera cuenta</h1>
          <p className="mt-2 text-muted">
            Necesitamos una cuenta para empezar a registrar ingresos, gastos y
            saldos.
          </p>
        </div>
      </div>

      <Card>
        <CreateAccountForm />
      </Card>
    </main>
  );
}
