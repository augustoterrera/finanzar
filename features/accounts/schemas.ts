import { z } from "zod";

const accountTypes = [
  "CASH",
  "BANK",
  "DIGITAL_WALLET",
  "SAVINGS",
  "INVESTMENT",
  "OTHER",
] as const;

export const createAccountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresá un nombre para identificar dónde tenés esa plata."),
  type: z.enum(accountTypes),
  currency: z
    .string()
    .trim()
    .length(3, "Usá el código de moneda de 3 letras.")
    .transform((value) => value.toUpperCase()),
  openingBalance: z.coerce.number().finite("Ingresá un saldo válido."),
});

export type CreateAccountState = {
  error?: string;
  fieldErrors?: {
    currency?: string[];
    name?: string[];
    openingBalance?: string[];
    type?: string[];
  };
};
