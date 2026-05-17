import type { FinancialAccount } from "@/lib/generated/prisma/client";
import { Landmark, Pencil, Trash2 } from "lucide-react";

import {
  deleteAccountAction,
  updateAccountAction,
} from "@/features/accounts/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils/format";

type AccountListProps = {
  accounts: FinancialAccount[];
};

export function AccountList({ accounts }: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <Card>
        <h2 className="font-bold">Todavía no hay cuentas financieras</h2>
        <p className="mt-2 text-sm text-muted">
          Agregá una para registrar movimientos.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {accounts.map((account) => {
        const updateAction = updateAccountAction.bind(null, account.id);
        const deleteAction = deleteAccountAction.bind(null, account.id);

        return (
          <Card className="p-4" key={account.id}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-primary">
                <Landmark aria-hidden="true" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-bold">{account.name}</h2>
                <p className="truncate text-sm text-muted">
                  {formatCurrency(Number(account.openingBalance), account.currency)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Modal
                  title="Editar cuenta financiera"
                  trigger={
                    <Button title="Editar cuenta financiera" type="button" variant="secondary">
                      <Pencil aria-hidden="true" size={18} />
                    </Button>
                  }
                >
                  <form action={updateAction} className="grid gap-3">
                    <FieldShell label="Nombre">
                      <TextInput
                        defaultValue={account.name}
                        name="name"
                        required
                        type="text"
                      />
                    </FieldShell>

                    <div className="grid gap-3 min-[380px]:grid-cols-2">
                      <FieldShell label="Tipo">
                        <SelectInput defaultValue={account.type} name="type" required>
                          <option value="BANK">Cuenta bancaria</option>
                          <option value="CASH">Efectivo / caja</option>
                          <option value="DIGITAL_WALLET">Billetera virtual</option>
                          <option value="SAVINGS">Ahorros</option>
                          <option value="INVESTMENT">Inversiones</option>
                          <option value="OTHER">Otro lugar</option>
                        </SelectInput>
                      </FieldShell>

                      <FieldShell label="Saldo">
                        <TextInput
                          defaultValue={account.openingBalance.toString()}
                          inputMode="decimal"
                          name="openingBalance"
                          required
                          step="0.01"
                          type="number"
                        />
                      </FieldShell>
                    </div>

                    <input name="currency" type="hidden" value={account.currency} />
                    <Button type="submit">Guardar cambios</Button>
                  </form>
                </Modal>
                <form action={deleteAction}>
                  <Button
                    title="Eliminar cuenta financiera"
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
