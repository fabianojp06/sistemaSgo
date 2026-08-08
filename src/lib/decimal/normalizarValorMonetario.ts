/**
 * Bug de QA: campos monetários/percentuais em formato brasileiro (vírgula decimal,
 * ex: "1000,00") eram rejeitados por `Prisma.Decimal` (só aceita ponto). Normaliza
 * antes do parse: remove separador de milhar "." quando há vírgula decimal, depois
 * troca "," por ".". Ex: "1.234,56" -> "1234.56"; "9,25" -> "9.25"; "9.25" (já com
 * ponto) permanece "9.25".
 */
export function normalizarValorMonetario(valor: string): string {
  const texto = valor.trim();
  if (texto.includes(',')) {
    return texto.replace(/\./g, '').replace(',', '.');
  }
  return texto;
}
