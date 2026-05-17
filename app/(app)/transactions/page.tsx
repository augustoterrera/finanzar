import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { getAccountsForActiveWorkspace } from "@/features/accounts/queries";
import { getCategoriesForActiveWorkspace } from "@/features/categories/queries";
import { TransactionCreateCard } from "@/features/transactions/components/transaction-create-card";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { getTransactionsForActiveWorkspace } from "@/features/transactions/queries";
import { requireActiveWorkspace } from "@/features/workspaces/queries";

export default async function TransactionsPage() {
  const activeWorkspace = await requireActiveWorkspace();
  const [accounts, categories, transactions] = await Promise.all([
    getAccountsForActiveWorkspace(),
    getCategoriesForActiveWorkspace(),
    getTransactionsForActiveWorkspace(),
  ]);

  if (accounts.length === 0) {
    redirect("/onboarding");
  }

  return (
    <main className="grid gap-6">
      <AppHeader
        title="Movimientos"
        workspaceName={activeWorkspace.workspace.name}
      />
      <TransactionCreateCard accounts={accounts} categories={categories} />
      <TransactionList
        accounts={accounts}
        categories={categories}
        transactions={transactions}
      />
    </main>
  );
}
