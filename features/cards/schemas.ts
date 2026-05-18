import { z } from "zod";

const cardNetworks = ["VISA", "MASTERCARD", "AMEX", "CABAL", "NARANJA", "OTHER"] as const;

const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .pipe(z.string().uuid().optional());

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const optionalAmount = z
  .union([z.literal(""), z.coerce.number().finite().nonnegative()])
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const baseCreditCardSchema = z.object({
  closingDay: z.coerce
    .number()
    .int("Usá un día entero.")
    .min(1, "El cierre tiene que ser entre el 1 y el 31.")
    .max(31, "El cierre tiene que ser entre el 1 y el 31."),
  creditLimit: optionalAmount,
  currency: z
    .string()
    .trim()
    .length(3, "Usá el código de moneda de 3 letras.")
    .transform((value) => value.toUpperCase()),
  dueDay: z.coerce
    .number()
    .int("Usá un día entero.")
    .min(1, "El vencimiento tiene que ser entre el 1 y el 31.")
    .max(31, "El vencimiento tiene que ser entre el 1 y el 31."),
  issuer: optionalText,
  lastFour: z
    .string()
    .trim()
    .regex(/^$|^\d{4}$/, "Ingresá los últimos 4 números o dejalo vacío.")
    .transform((value) => (value === "" ? undefined : value)),
  name: z.string().trim().min(2, "Ingresá un nombre para identificar la tarjeta."),
  network: z.enum(cardNetworks),
  paymentAccountId: optionalUuid,
});

export const createCreditCardSchema = baseCreditCardSchema;
export const updateCreditCardSchema = baseCreditCardSchema;

export const cardPurchaseSchema = z.object({
  categoryId: optionalUuid,
  creditCardId: z.string().uuid(),
  description: z.string().trim().min(2, "Contanos qué compraste."),
  installmentsCount: z.coerce
    .number()
    .int("Usá una cantidad entera.")
    .min(1, "La compra necesita al menos 1 cuota.")
    .max(60, "Usá 60 cuotas como máximo."),
  merchant: optionalText,
  purchasedAt: z.coerce.date(),
  totalAmount: z.coerce
    .number()
    .finite("Ingresá un importe válido.")
    .positive("El importe tiene que ser mayor a cero."),
});

export const cardPaymentSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.coerce
    .number()
    .finite("Ingresá un importe válido.")
    .positive("El pago tiene que ser mayor a cero."),
  creditCardId: z.string().uuid(),
  notes: optionalText,
  paidAt: z.coerce.date(),
  statementId: optionalUuid,
});
