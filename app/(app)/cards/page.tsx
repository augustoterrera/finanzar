import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/features/workspaces/queries";

export default async function CardsPage() {
  const activeWorkspace = await requireActiveWorkspace();

  return (
    <main className="grid gap-6">
      <AppHeader
        title="Tarjetas"
        workspaceName={activeWorkspace.workspace.name}
      />
      <Card>
        <h2 className="text-lg font-bold">Tarjetas y resúmenes</h2>
        <p className="mt-2 text-sm text-muted">
          Esta sección va a manejar consumos, cierres, vencimientos y pagos.
        </p>
      </Card>
    </main>
  );
}
