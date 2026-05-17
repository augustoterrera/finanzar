import { Plus } from "lucide-react";

import { createAccountFormAction } from "@/features/accounts/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";

export function AccountCreateCard() {
  return (
    <Card className="p-4">
      <form action={createAccountFormAction} className="grid gap-3">
        <input name="redirectTo" type="hidden" value="/accounts" />

        <div>
          <h2 className="font-bold">Agregar cuenta financiera</h2>
          <p className="mt-1 text-sm text-muted">
            Banco, efectivo, billetera o caja.
          </p>
        </div>

        <FieldShell label="Nombre">
          <TextInput
            autoComplete="off"
            name="name"
            placeholder="Mercado Pago"
            required
            type="text"
          />
        </FieldShell>

        <div className="grid gap-3 min-[380px]:grid-cols-2">
          <FieldShell label="Tipo">
            <SelectInput defaultValue="DIGITAL_WALLET" name="type" required>
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
              defaultValue="0"
              inputMode="decimal"
              name="openingBalance"
              required
              step="0.01"
              type="number"
            />
          </FieldShell>
        </div>

        <input name="currency" type="hidden" value="ARS" />

        <Button className="w-full" type="submit">
          <Plus aria-hidden="true" size={18} />
          Agregar
        </Button>
      </form>
    </Card>
  );
}
