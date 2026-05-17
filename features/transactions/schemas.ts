import { z } from "zod";

const transactionTypes = ["INCOME", "EXPENSE"] as const;

export const transactionSchema = z.object({
  accountId: z.string().uuid("Elegí una cuenta financiera."),
  amount: z.coerce
    .number()
    .positive("Ingresá un monto mayor a 0.")
    .finite("Ingresá un monto válido."),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().trim().min(2, "Ingresá una descripción."),
  occurredAt: z.coerce.date(),
  type: z.enum(transactionTypes),
});
