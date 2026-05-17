import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/features/workspaces/queries";

export default async function TransactionsPage() {
  const activeWorkspace = await requireActiveWorkspace();

  return (
    <main className="grid gap-6">
      <AppHeader
        title="Movimientos"
        workspaceName={activeWorkspace.workspace.name}
      />
      <Card>
        <h2 className="text-lg font-bold">Próximo paso</h2>
        <p className="mt-2 text-sm text-muted">
          Acá vamos a crear el listado y alta rápida de ingresos y gastos.
        </p>
      </Card>
    </main>
  );
}
