import { createHash, randomUUID } from "node:crypto";

// UUID determinístico por comprador/tentativa; a PK existente do pedido é a
// persistência da chave. Não depende de tabela ou migração adicional.
export function idDoPedido(compradorId: string, chave?: string): string {
  if (chave === undefined) return randomUUID(); // contrato anterior
  const bytes = createHash("sha256").update(`raizes-pe:checkout:${compradorId.toLowerCase()}:${chave.toLowerCase()}`).digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function assinaturaItens(itens: Iterable<{ produtoId: string; quantidade: number }>): string {
  const quantidades = new Map<string, number>();
  for (const item of itens) {
    const id = item.produtoId.toLowerCase();
    quantidades.set(id, (quantidades.get(id) ?? 0) + item.quantidade);
  }
  return JSON.stringify([...quantidades.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
