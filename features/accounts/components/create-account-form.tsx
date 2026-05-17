"use client";

import { useActionState } from "react";
import { Landmark } from "lucide-react";

import { createAccountAction } from "@/features/accounts/actions";
import type { CreateAccountState } from "@/features/accounts/schemas";
import { Button } from "@/components/ui/button";
import { FieldShell, SelectInput, TextInput } from "@/components/ui/field";

const initialState: CreateAccountState = {};

export function CreateAccountForm() {
  const [state, formAction, isPending] = useActionState(
    createAccountAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid min-w-0 gap-3.5">
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <FieldShell
        error={state.fieldErrors?.name?.[0]}
        label="Nombre"
      >
        <TextInput
          autoComplete="off"
          name="name"
          placeholder="Cuenta sueldo"
          required
          type="text"
        />
      </FieldShell>

      <FieldShell
        error={state.fieldErrors?.type?.[0]}
        label="Tipo"
      >
        <SelectInput defaultValue="BANK" name="type" required>
          <option value="BANK">Cuenta bancaria</option>
          <option value="CASH">Efectivo / caja</option>
          <option value="DIGITAL_WALLET">Billetera virtual</option>
          <option value="SAVINGS">Ahorros</option>
          <option value="INVESTMENT">Inversiones</option>
          <option value="OTHER">Otro lugar</option>
        </SelectInput>
      </FieldShell>

      <div className="grid min-w-0 gap-3 min-[380px]:grid-cols-[0.8fr_1.2fr]">
        <FieldShell error={state.fieldErrors?.currency?.[0]} label="Moneda">
          <TextInput
            defaultValue="ARS"
            maxLength={3}
            name="currency"
            required
            type="text"
          />
        </FieldShell>

        <FieldShell
          error={state.fieldErrors?.openingBalance?.[0]}
          label="Saldo actual"
        >
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

      <p className="text-sm leading-5 text-muted">
        Si no sabés el saldo exacto, dejalo en 0.
      </p>

      <Button
        className="mt-1 min-h-12 w-full text-base"
        disabled={isPending}
        type="submit"
      >
        <Landmark aria-hidden="true" size={19} />
        {isPending ? "Guardando..." : "Continuar"}
      </Button>
    </form>
  );
}
