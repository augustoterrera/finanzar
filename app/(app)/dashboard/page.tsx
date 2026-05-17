import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Landmark, Wallet } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { getAccountsForActiveWorkspace } from "@/features/accounts/queries";
import { getActiveWorkspace } from "@/features/workspaces/queries";

export default async function DashboardPage() {
  const activeWorkspace = await getActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/sign-in");
  }

  if (activeWorkspace.accountCount === 0) {
    redirect("/onboarding");
  }

  const accounts = await getAccountsForActiveWorkspace();
  const totalBalance = accounts.reduce(
    (total, account) => total + Number(account.openingBalance),
    0,
  );

  return (
    <main className="grid gap-6">
      <AppHeader
        subtitle="Resumen inicial de tu espacio financiero"
        title="Inicio"
        workspaceName={activeWorkspace.workspace.name}
      />

      <Card className="grid gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-muted">Saldo inicial</p>
            <p className="mt-2 text-3xl font-bold">
              {new Intl.NumberFormat("es-AR", {
                currency: activeWorkspace.workspace.baseCurrency,
                style: "currency",
              }).format(totalBalance)}
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-white">
            <Wallet aria-hidden="true" size={24} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <ArrowDownLeft
            aria-hidden="true"
            className="text-primary"
            size={22}
          />
          <p className="mt-3 text-sm text-muted">Ingresos mes</p>
          <p className="mt-1 text-xl font-bold">$0,00</p>
        </Card>
        <Card className="p-4">
          <ArrowUpRight
            aria-hidden="true"
            className="text-secondary-strong"
            size={22}
          />
          <p className="mt-3 text-sm text-muted">Gastos mes</p>
          <p className="mt-1 text-xl font-bold">$0,00</p>
        </Card>
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
            <Landmark aria-hidden="true" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Cuentas activas</h2>
            <p className="mt-1 text-sm text-muted">
              Tenés {accounts.length} cuenta{accounts.length === 1 ? "" : "s"}{" "}
              configurada{accounts.length === 1 ? "" : "s"}. El siguiente paso
              es registrar movimientos reales.
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}
