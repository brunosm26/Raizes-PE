import { pool } from "./db";
import { listarProdutos, resolverId } from "./servidor/catalogo";
import { rankearRecomendacoes } from "./rankingRecomendacao";
import type { ProdutoRecomendado } from "./rankingRecomendacao";

export type { CriterioRecomendacao, ProdutoRecomendado } from "./rankingRecomendacao";

/**
 * Baseline de Recomendação Inteligente (PI4-20 / PI4-27):
 * 1. Filtra produtos indisponíveis (estoqueQtd <= 0).
 * 2. Personaliza com base no histórico do comprador (técnicas e regiões já adquiridas).
 * 3. Fallback / Cold Start com produtos bem avaliados e populares.
 * 4. Explicabilidade: Fornece um motivo amigável para cada item recomendado.
 *
 * Roda só no servidor (rota /api/recomendacoes): lê do PostgreSQL e entrega os dados
 * à regra de pontuação (lib/rankingRecomendacao.ts), que não depende do banco.
 */
export async function calcularRecomendacoes(
  compradorIdBruto?: string,
  limite = 4
): Promise<ProdutoRecomendado[]> {
  const compradorId = compradorIdBruto ? resolverId(compradorIdBruto) : undefined;

  const [produtos, avaliacoesRes, compradosRes] = await Promise.all([
    listarProdutos({}),
    pool.query<{ produtoId: string; media: number; qtd: number }>(
      `SELECT produto_id AS "produtoId", AVG(nota)::float8 AS media, COUNT(*)::int AS qtd
         FROM origem.avaliacao GROUP BY produto_id`
    ),
    compradorId && /^[0-9a-f-]{36}$/i.test(compradorId)
      ? pool.query<{ produtoId: string; quantidade: number }>(
          `SELECT ip.produto_id AS "produtoId", SUM(ip.quantidade)::int AS quantidade
             FROM origem.pedido pe
             JOIN origem.item_pedido ip ON ip.pedido_id = pe.id
            WHERE pe.comprador_id = $1
            GROUP BY ip.produto_id`,
          [compradorId]
        )
      : Promise.resolve({ rows: [] as { produtoId: string; quantidade: number }[] }),
  ]);

  return rankearRecomendacoes(
    { produtos, avaliacoes: avaliacoesRes.rows, comprados: compradosRes.rows },
    limite
  );
}
