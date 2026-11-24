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

export async function inserirSeElegivel(produtoId: string, compradorId: string, nota: number) {
  const { rows } = await executorPadrao().query<{ permitido: boolean; gravada: boolean }>(
    `WITH elegivel AS (
       SELECT EXISTS (
         SELECT 1 FROM origem.pedido pe
         JOIN origem.item_pedido ip ON ip.pedido_id = pe.id
         WHERE pe.comprador_id = $2 AND pe.status = 'entregue' AND ip.produto_id = $1
       ) AS permitido
     ), inserida AS (
       INSERT INTO origem.avaliacao (produto_id, comprador_id, nota)
       SELECT $1::uuid, $2::uuid, $3::int FROM elegivel WHERE permitido
       ON CONFLICT (produto_id, comprador_id) DO NOTHING
       RETURNING id
     )
     SELECT permitido, EXISTS (SELECT 1 FROM inserida) AS gravada FROM elegivel`,
    [produtoId, compradorId, nota]
  );
  return rows[0]!;
}
