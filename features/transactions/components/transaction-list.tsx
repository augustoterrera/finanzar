import {
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Pencil,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  deleteTransactionAction,
  updateTransactionAction,
} from "@/features/transactions/actions";
import type {
  Category,
  FinancialAccount,
  Transaction,
} from "@/lib/generated/prisma/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type TransactionWithRelations = Transaction & {
  category: Category | null;
  fromAccount: FinancialAccount | null;
  toAccount: FinancialAccount | null;
};

type TransactionListProps = {
  accounts: FinancialAccount[];
  categories: Category[];
  transactions: TransactionWithRelations[];
};

export function TransactionList({
  accounts,
  categories,
  transactions,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <h2 className="font-bold">Todavía no hay movimientos</h2>
        <p className="mt-2 text-sm text-muted">
          Cargá tu primer ingreso o gasto para empezar a ver el resumen real.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {transactions.map((transaction) => {
        const isIncome = transaction.type === "INCOME";
        const account = isIncome
          ? transaction.toAccount
          : transaction.fromAccount;
        const selectedAccountId = account?.id ?? "";
        const updateAction = updateTransactionAction.bind(null, transaction.id);
        const deleteAction = deleteTransactionAction.bind(null, transaction.id);

        return (
          <Card className="p-4" key={transaction.id}>
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    isIncome
                      ? "bg-emerald-500/12 text-emerald-500"
                      : "bg-red-500/12 text-red-500"
                  }`}
                >
                  {isIncome ? (
                    <TrendingUp aria-hidden="true" size={20} />
                  ) : (
                    <TrendingDown aria-hidden="true" size={20} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 font-bold leading-snug">
                    {transaction.description}
                  </h2>
                  <p
                    className={`mt-1 text-lg font-bold ${
                      isIncome ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {formatCurrency(
                      Number(transaction.amount),
                      transaction.currency,
                    )}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                    <CalendarDays aria-hidden="true" size={15} />
                    {formatDate(transaction.occurredAt)}
                  </p>
                  <p className="mt-1 truncate text-sm text-muted">
                    {account?.name ?? "Sin cuenta"} ·{" "}
                    {transaction.category?.name ?? "Sin categoría"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Modal
                  title="Editar movimiento"
                  trigger={
                    <Button className="w-full" type="button" variant="secondary">
                      <Pencil aria-hidden="true" size={18} />
                      Editar
                    </Button>
                  }
                >
                  <form action={updateAction} className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FieldShell label="Tipo">
                        <SelectInput defaultValue={transaction.type} name="type" required>
                          <option value="EXPENSE">Gasto</option>
                          <option value="INCOME">Ingreso</option>
                        </SelectInput>
                      </FieldShell>

                      <FieldShell label="Monto">
                        <TextInput
                          defaultValue={transaction.amount.toString()}
                          inputMode="decimal"
                          name="amount"
                          required
                          step="0.01"
                          type="number"
                        />
                      </FieldShell>
                    </div>

                    <FieldShell label="Descripción">
                      <TextInput
                        defaultValue={transaction.description}
                        name="description"
                        required
                        type="text"
                      />
                    </FieldShell>

                    <div className="grid gap-3 min-[380px]:grid-cols-2">
                      <FieldShell label="Cuenta">
                        <SelectInput
                          defaultValue={selectedAccountId}
                          name="accountId"
                          required
                        >
                          {accounts.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </SelectInput>
                      </FieldShell>

                      <FieldShell label="Categoría">
                        <SelectInput
                          defaultValue={transaction.categoryId ?? ""}
                          name="categoryId"
                        >
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
                      <TextInput
                        defaultValue={transaction.occurredAt
                          .toISOString()
                          .slice(0, 10)}
                        name="occurredAt"
                        required
                        type="date"
                      />
                    </FieldShell>

                    <Button type="submit">Guardar cambios</Button>
                  </form>
                </Modal>
                <form action={deleteAction}>
                  <Button
                    title="Eliminar movimiento"
                    type="submit"
                    variant="secondary"
                  >
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
