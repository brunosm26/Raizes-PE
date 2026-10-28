import { obterPrisma } from "../config/prisma";

// Linha da view origem.vw_popularidade_produto (db/01_ddl_origem.sql).
// A view não é modelo Prisma: é lida com SQL direto.
export interface PopularidadeProduto {
  produtoId: string;
  qtdVendida: number;
  totalAvaliacoes: number;
  // null quando o produto ainda não tem avaliação.
  notaMedia: number | null;
}

interface LinhaPopularidade {
  produto_id: string;
  qtd_vendida: number;
  total_avaliacoes: number;
  nota_media: string | null; // NUMERIC chega como texto para não perder precisão
}

export async function listarPopularidade(): Promise<PopularidadeProduto[]> {
  const linhas = await obterPrisma().$queryRaw<LinhaPopularidade[]>`
    SELECT produto_id::text AS produto_id,
           qtd_vendida,
           total_avaliacoes,
           nota_media::text AS nota_media
      FROM origem.vw_popularidade_produto
  `;

  return linhas.map((l) => ({
    produtoId: l.produto_id,
    qtdVendida: l.qtd_vendida,
    totalAvaliacoes: l.total_avaliacoes,
    notaMedia: l.nota_media === null ? null : Number(l.nota_media),
  }));
}
