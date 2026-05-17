import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
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

  return (
    <div className="min-h-dvh bg-background md:flex">
      <AppSidebar workspaceName={activeWorkspace.workspace.name} />
      <div className="min-w-0 flex-1 pb-32 md:pb-0">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
