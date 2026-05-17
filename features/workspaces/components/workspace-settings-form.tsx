import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";
import { updateWorkspaceSettingsAction } from "@/features/workspaces/actions";

type WorkspaceSettingsFormProps = {
  workspace: {
    baseCurrency: string;
    name: string;
    type: "BUSINESS" | "HOUSEHOLD" | "PERSONAL";
  };
};

export function WorkspaceSettingsForm({
  workspace,
}: WorkspaceSettingsFormProps) {
  return (
    <Card className="p-4">
      <form action={updateWorkspaceSettingsAction} className="grid gap-3">
        <div>
          <h2 className="font-bold">Espacio financiero</h2>
          <p className="mt-1 text-sm text-muted">
            Ajustes básicos para este espacio.
          </p>
        </div>

        <FieldShell label="Nombre">
          <TextInput
            defaultValue={workspace.name}
            name="name"
            placeholder="Casa, personal, negocio"
            required
            type="text"
          />
        </FieldShell>

        <div className="grid gap-3 min-[380px]:grid-cols-2">
          <FieldShell label="Tipo">
            <SelectInput defaultValue={workspace.type} name="type" required>
              <option value="PERSONAL">Personal</option>
              <option value="HOUSEHOLD">Hogar / familia</option>
              <option value="BUSINESS">Negocio</option>
            </SelectInput>
          </FieldShell>

          <FieldShell label="Moneda base">
            <TextInput
              defaultValue={workspace.baseCurrency}
              maxLength={3}
              name="baseCurrency"
              required
              type="text"
            />
          </FieldShell>
        </div>

        <Button className="w-full" type="submit">
          <Save aria-hidden="true" size={18} />
          Guardar ajustes
        </Button>
      </form>
    </Card>
  );
}
