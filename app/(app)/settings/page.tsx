import Link from "next/link";
import { Tags } from "lucide-react";

import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { WorkspaceSettingsForm } from "@/features/workspaces/components/workspace-settings-form";
import { requireActiveWorkspace } from "@/features/workspaces/queries";

export default async function SettingsPage() {
  const activeWorkspace = await requireActiveWorkspace();

  return (
    <main className="grid gap-6">
      <AppHeader
        title="Ajustes"
        workspaceName={activeWorkspace.workspace.name}
      />
      <WorkspaceSettingsForm workspace={activeWorkspace.workspace} />

      <Link href="/categories">
        <Card className="p-4 transition hover:bg-surface-muted">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-surface-muted text-primary">
              <Tags aria-hidden="true" size={20} />
            </div>
            <div>
              <h2 className="font-bold">Categorías</h2>
              <p className="mt-1 text-sm text-muted">
                Ordená ingresos y gastos.
              </p>
            </div>
          </div>
        </Card>
      </Link>
    </main>
  );
}
