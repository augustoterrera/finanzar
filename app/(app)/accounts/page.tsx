import { AppHeader } from "@/components/layout/app-header";
import { AccountCreateCard } from "@/features/accounts/components/account-create-card";
import { AccountList } from "@/features/accounts/components/account-list";
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

      <AccountCreateCard />
      <AccountList accounts={accounts} />
    </main>
  );
}
