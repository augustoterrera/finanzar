import { Plus } from "lucide-react";

import { createCategoryAction } from "@/features/categories/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";

export function CategoryCreateCard() {
  return (
    <Card className="p-4">
      <form action={createCategoryAction} className="grid gap-3">
        <div>
          <h2 className="font-bold">Agregar categoría</h2>
          <p className="mt-1 text-sm text-muted">
            Para ordenar ingresos y gastos.
          </p>
        </div>

        <FieldShell label="Nombre">
          <TextInput
            autoComplete="off"
            name="name"
            placeholder="Comida"
            required
            type="text"
          />
        </FieldShell>

        <div className="grid gap-3 min-[380px]:grid-cols-2">
          <FieldShell label="Uso">
            <SelectInput defaultValue="EXPENSE" name="type" required>
              <option value="EXPENSE">Gastos</option>
              <option value="INCOME">Ingresos</option>
              <option value="BOTH">Ambos</option>
            </SelectInput>
          </FieldShell>

          <FieldShell label="Color">
            <TextInput defaultValue="#378add" name="color" type="color" />
          </FieldShell>
        </div>

        <input name="icon" type="hidden" value="Tag" />

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar
        </Button>
      </form>
    </Card>
  );
}
