import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { requireActiveWorkspace } from "@/features/workspaces/queries";

export default async function ProjectsPage() {
  const activeWorkspace = await requireActiveWorkspace();

  return (
    <main className="grid gap-6">
      <AppHeader
        title="Proyectos"
        workspaceName={activeWorkspace.workspace.name}
      />
      <Card>
        <h2 className="text-lg font-bold">Proyectos y cobros</h2>
        <p className="mt-2 text-sm text-muted">
          Acá vamos a organizar trabajos, cobros esperados y pagos asociados.
        </p>
      </Card>
    </main>
  );
}
