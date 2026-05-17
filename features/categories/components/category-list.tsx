import type { Category } from "@/lib/generated/prisma/client";
import { Pencil, Tag, Trash2 } from "lucide-react";

import {
  deleteCategoryAction,
  updateCategoryAction,
} from "@/features/categories/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

type CategoryListProps = {
  categories: Category[];
};

const typeLabels = {
  BOTH: "Ambos",
  EXPENSE: "Gastos",
  INCOME: "Ingresos",
};

export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <Card>
        <h2 className="font-bold">Todavía no hay categorías</h2>
        <p className="mt-2 text-sm text-muted">
          Agregá una para clasificar movimientos.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {categories.map((category) => {
        const updateAction = updateCategoryAction.bind(null, category.id);
        const deleteAction = deleteCategoryAction.bind(null, category.id);

        return (
          <Card className="p-4" key={category.id}>
            <div className="flex items-center gap-3">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: category.color ?? "#378add" }}
              >
                <Tag aria-hidden="true" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-bold">{category.name}</h2>
                <p className="text-sm text-muted">
                  {typeLabels[category.type]}
                  {category.isSystem ? " · base" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Modal
                  title="Editar categoría"
                  trigger={
                    <Button title="Editar categoría" type="button" variant="secondary">
                      <Pencil aria-hidden="true" size={18} />
                    </Button>
                  }
                >
                  <form action={updateAction} className="grid gap-3">
                    <FieldShell label="Nombre">
                      <TextInput
                        defaultValue={category.name}
                        name="name"
                        required
                        type="text"
                      />
                    </FieldShell>

                    <div className="grid gap-3 min-[380px]:grid-cols-2">
                      <FieldShell label="Uso">
                        <SelectInput defaultValue={category.type} name="type" required>
                          <option value="EXPENSE">Gastos</option>
                          <option value="INCOME">Ingresos</option>
                          <option value="BOTH">Ambos</option>
                        </SelectInput>
                      </FieldShell>

                      <FieldShell label="Color">
                        <TextInput
                          defaultValue={category.color ?? "#378add"}
                          name="color"
                          type="color"
                        />
                      </FieldShell>
                    </div>

                    <input name="icon" type="hidden" value={category.icon ?? "Tag"} />
                    <Button type="submit">Guardar cambios</Button>
                  </form>
                </Modal>
                <form action={deleteAction}>
                  <Button title="Eliminar categoría" type="submit" variant="secondary">
                    <Trash2 aria-hidden="true" size={18} />
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
