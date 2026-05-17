import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getAccountsForActiveWorkspace } from "@/features/accounts/queries";
import { getCategoriesForActiveWorkspace } from "@/features/categories/queries";
import { QuickAddTransaction } from "@/features/transactions/components/quick-add-transaction";
import { getActiveWorkspace } from "@/features/workspaces/queries";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const activeWorkspace = await getActiveWorkspace();

  if (!activeWorkspace) {
    redirect("/sign-in");
  }

  const [accounts, categories] = await Promise.all([
    getAccountsForActiveWorkspace(),
    getCategoriesForActiveWorkspace(),
  ]);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background md:flex">
      <AppSidebar workspaceName={activeWorkspace.workspace.name} />
      <div className="min-w-0 flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8 md:py-6">
          {children}
        </div>
      </div>
      {accounts.length > 0 ? (
        <QuickAddTransaction accounts={accounts} categories={categories} />
      ) : null}
      <BottomNav />
    </div>
  );
}
