import type { ResumoAvaliacoes } from "../types/dominio";
import { executorPadrao } from "./transacao";

// Acesso à tabela origem.avaliacao.

export async function resumirDoProduto(produtoId: string): Promise<ResumoAvaliacoes> {
  const { rows } = await executorPadrao().query<ResumoAvaliacoes>(
    `SELECT COALESCE(AVG(nota), 0)::float8 AS media,
            COUNT(*)::int                  AS quantidade
       FROM origem.avaliacao
      WHERE produto_id = $1`,
    [produtoId]
  );
  return rows[0] ?? { media: 0, quantidade: 0 };
}

export async function resumirPorProduto(): Promise<{ produtoId: string; media: number; qtd: number }[]> {
  const { rows } = await executorPadrao().query<{ produtoId: string; media: number; qtd: number }>(
    `SELECT produto_id AS "produtoId", AVG(nota)::float8 AS media, COUNT(*)::int AS qtd
       FROM origem.avaliacao GROUP BY produto_id`
  );
  return rows;
}
