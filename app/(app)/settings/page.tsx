import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/features/workspaces/queries";

export default async function SettingsPage() {
  const activeWorkspace = await requireActiveWorkspace();

  return (
    <main className="grid gap-6">
      <AppHeader
        title="Ajustes"
        workspaceName={activeWorkspace.workspace.name}
      />
      <Card>
        <h2 className="text-lg font-bold">Configuración del espacio</h2>
        <p className="mt-2 text-sm text-muted">
          Más adelante vas a poder cambiar moneda, miembros y preferencias.
        </p>
      </Card>
    </main>
  );
}
