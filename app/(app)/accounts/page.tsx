import { Landmark } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { getAccountsForActiveWorkspace } from "@/features/accounts/queries";
import { requireActiveWorkspace } from "@/features/workspaces/queries";

export default async function AccountsPage() {
  const activeWorkspace = await requireActiveWorkspace();
  const accounts = await getAccountsForActiveWorkspace();

  return (
    <main className="grid gap-6">
      <AppHeader
        title="Cuentas"
        workspaceName={activeWorkspace.workspace.name}
      />

      <div className="grid gap-3">
        {accounts.map((account) => (
          <Card className="p-4" key={account.id}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-surface-muted text-primary">
                <Landmark aria-hidden="true" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-bold">{account.name}</h2>
                <p className="text-sm text-muted">{account.type}</p>
              </div>
              <p className="font-semibold">
                {new Intl.NumberFormat("es-AR", {
                  currency: account.currency,
                  style: "currency",
                }).format(Number(account.openingBalance))}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
