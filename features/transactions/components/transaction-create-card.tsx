import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";
import { createTransactionAction } from "@/features/transactions/actions";
import type { Category, FinancialAccount } from "@/lib/generated/prisma/client";

type TransactionCreateCardProps = {
  accounts: FinancialAccount[];
  categories: Category[];
};

export function TransactionCreateCard({
  accounts,
  categories,
}: TransactionCreateCardProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-4">
      <form action={createTransactionAction} className="grid gap-3">
        <div>
          <h2 className="font-bold">Nuevo movimiento</h2>
          <p className="mt-1 text-sm text-muted">Registrá un ingreso o gasto.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldShell label="Tipo">
            <SelectInput defaultValue="EXPENSE" name="type" required>
              <option value="EXPENSE">Gasto</option>
              <option value="INCOME">Ingreso</option>
            </SelectInput>
          </FieldShell>

          <FieldShell label="Monto">
            <TextInput
              inputMode="decimal"
              name="amount"
              placeholder="0"
              required
              step="0.01"
              type="number"
            />
          </FieldShell>
        </div>

        <FieldShell label="Descripción">
          <TextInput
            autoComplete="off"
            name="description"
            placeholder="Supermercado"
            required
            type="text"
          />
        </FieldShell>

        <div className="grid gap-3 min-[380px]:grid-cols-2">
          <FieldShell label="Cuenta">
            <SelectInput name="accountId" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectInput>
          </FieldShell>

          <FieldShell label="Categoría">
            <SelectInput name="categoryId">
              <option value="">Sin categoría</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectInput>
          </FieldShell>
        </div>

        <FieldShell label="Fecha">
          <TextInput defaultValue={today} name="occurredAt" required type="date" />
        </FieldShell>

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar movimiento
        </Button>
      </form>
    </Card>
  );
}
