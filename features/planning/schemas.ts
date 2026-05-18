import { z } from "zod";

const frequencies = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "YEARLY",
] as const;

const optionalUuid = z.preprocess(
  (value) => (value == null ? "" : value),
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.string().uuid().optional()),
);

const optionalText = z
  .preprocess((value) => (value == null ? "" : value), z.string())
  .transform((value) => {
    const trimmedValue = value.trim();

    return trimmedValue === "" ? undefined : trimmedValue;
  });

export const recurringRuleSchema = z.object({
  accountId: optionalUuid,
  amount: z.coerce
    .number()
    .finite("Ingresá un importe válido.")
    .positive("El importe tiene que ser mayor a cero."),
  categoryId: optionalUuid,
  dayOfMonth: z.preprocess(
    (value) => (value == null || value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(31).optional(),
  ),
  description: z.string().trim().min(2, "Ingresá una descripción."),
  frequency: z.enum(frequencies),
  startAt: z.coerce.date(),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export const subscriptionSchema = z.object({
  amount: z.coerce
    .number()
    .finite("Ingresá un importe válido.")
    .positive("El importe tiene que ser mayor a cero."),
  categoryId: optionalUuid,
  creditCardId: optionalUuid,
  frequency: z.enum(frequencies),
  name: z.string().trim().min(2, "Ingresá el nombre de la suscripción."),
  nextBillingAt: z.coerce.date(),
  provider: optionalText,
  sourceAccountId: optionalUuid,
});

export const budgetSchema = z.object({
  amount: z.coerce
    .number()
    .finite("Ingresá un importe válido.")
    .positive("El presupuesto tiene que ser mayor a cero."),
  categoryId: optionalUuid,
  endsAt: z.coerce.date(),
  name: z.string().trim().min(2, "Ingresá un nombre para el presupuesto."),
  startsAt: z.coerce.date(),
});

export const reminderSchema = z.object({
  description: optionalText,
  dueAt: z.coerce.date(),
  title: z.string().trim().min(2, "Ingresá un título para el recordatorio."),
});
