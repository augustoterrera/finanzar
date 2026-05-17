import { redirect } from "next/navigation";
import { Landmark, Wallet } from "lucide-react";

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
    <main className="grid min-h-dvh place-items-center overflow-hidden bg-background px-4 py-6">
      <div className="grid w-full min-w-0 max-w-[22rem] gap-4">
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
              <Wallet aria-hidden="true" size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">
                {activeWorkspace.workspace.name}
              </p>
              <p className="text-sm text-muted">Primer paso</p>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold leading-tight">
              ¿Dónde tenés plata?
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Efectivo, banco, billetera o caja del negocio.
            </p>
          </div>
        </div>

        <Card className="overflow-hidden p-4">
          <div className="mb-4 flex items-start gap-2 text-sm leading-5 text-muted">
            <Landmark
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-primary"
              size={18}
            />
            <span>Es una cuenta financiera, no otro usuario.</span>
          </div>
          <CreateAccountForm />
        </Card>
      </div>
    </main>
  );
}
