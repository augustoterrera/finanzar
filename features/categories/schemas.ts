import { z } from "zod";

const categoryTypes = ["INCOME", "EXPENSE", "BOTH"] as const;

export const categorySchema = z.object({
  color: z.string().trim().optional(),
  icon: z.string().trim().optional(),
  name: z.string().trim().min(2, "Ingresá un nombre para la categoría."),
  type: z.enum(categoryTypes),
});
