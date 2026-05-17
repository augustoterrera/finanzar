import { redirect } from "next/navigation";
import { Landmark, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { getAccountsForActiveWorkspace } from "@/features/accounts/queries";
import {
  getCurrentMonthSummary,
  getWorkspaceBalance,
} from "@/features/transactions/queries";
import { getActiveWorkspace } from "@/features/workspaces/queries";
import { formatCurrency } from "@/lib/utils/format";

export default async function DashboardPage() {
  const activeWorkspace = await getActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/sign-in");
  }

  if (activeWorkspace.accountCount === 0) {
    redirect("/onboarding");
  }

  const [accounts, currentMonthSummary, totalBalance] = await Promise.all([
    getAccountsForActiveWorkspace(),
    getCurrentMonthSummary(),
    getWorkspaceBalance(),
  ]);

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
            <p className="text-sm font-semibold text-muted">Saldo estimado</p>
            <p className="mt-2 text-3xl font-bold">
              {formatCurrency(totalBalance, activeWorkspace.workspace.baseCurrency)}
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-white">
            <Wallet aria-hidden="true" size={24} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-500">
            <TrendingUp aria-hidden="true" size={22} />
          </div>
          <p className="mt-3 text-sm text-muted">Ingresos mes</p>
          <p className="mt-1 truncate text-xl font-bold text-emerald-500">
            {formatCurrency(
              currentMonthSummary.income,
              activeWorkspace.workspace.baseCurrency,
            )}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/12 text-red-500">
            <TrendingDown aria-hidden="true" size={22} />
          </div>
          <p className="mt-3 text-sm text-muted">Gastos mes</p>
          <p className="mt-1 truncate text-xl font-bold text-red-500">
            {formatCurrency(
              currentMonthSummary.expense,
              activeWorkspace.workspace.baseCurrency,
            )}
          </p>
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
              configurada{accounts.length === 1 ? "" : "s"}. Ya podés cargar
              ingresos y gastos desde Movimientos.
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}
