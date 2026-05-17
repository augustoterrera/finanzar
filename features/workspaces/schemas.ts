import { z } from "zod";

const workspaceTypes = ["PERSONAL", "HOUSEHOLD", "BUSINESS"] as const;

export const workspaceSettingsSchema = z.object({
  baseCurrency: z
    .string()
    .trim()
    .length(3, "Usá una moneda de 3 letras.")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Ingresá un nombre para el espacio."),
  type: z.enum(workspaceTypes),
});
