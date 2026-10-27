import { executorPadrao } from "./transacao";

// Consulta mínima para provar que a API alcança o banco (rota /api/saude-bd).
export async function contarProdutos(): Promise<number> {
  const { rows } = await executorPadrao().query<{ produtos: number }>(
    "SELECT count(*)::int AS produtos FROM origem.produto"
  );
  return rows[0]?.produtos ?? 0;
}
