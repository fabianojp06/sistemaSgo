import { z } from 'zod';

/**
 * RN0016 — Login/Senha não aceitam nulos ou espaços em branco.
 * CA-01.01.04/05/06 — campo tratado como vazio quando só contém espaços.
 */
export const EfetuarLoginInputSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, 'Login e/ou Senha são obrigatórios'),
  senha: z
    .string()
    .min(1, 'Login e/ou Senha são obrigatórios'),
  ipEstacao: z.string().optional(),
});

export type EfetuarLoginInput = z.infer<typeof EfetuarLoginInputSchema>;

export type EfetuarLoginOutput = {
  redirectTo: string;
};
