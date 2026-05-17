import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre."),
  email: z
    .string()
    .trim()
    .email("Ingresá un email válido.")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export type SignUpState = {
  error?: string;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
};
