// Lê um parâmetro de query como texto. ?a=1&a=2 vira "1" (o primeiro), como no
// URLSearchParams.get do front.
export function textoDaQuery(valor: unknown): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return typeof v === "string" ? v : undefined;
}
