import type { ProdutoComArtesao } from "../types/dominio";

export type CriterioRecomendacao =
  | "historico_tecnica"
  | "historico_regiao"
  | "popularidade"
  | "novidade";

export interface ProdutoRecomendado extends ProdutoComArtesao {
  motivo: string;
  score: number;
  criterio: CriterioRecomendacao;
}

// Tudo o que o ranking precisa saber, já resumido. Quem monta isto (o banco, em
// produção; os dados falsos, nos testes) fica fora da regra de pontuação.
export interface EntradaRecomendacao {
  produtos: ProdutoComArtesao[];
  avaliacoes: { produtoId: string; media: number; qtd: number }[];
  // Itens que o comprador já adquiriu (vazio para visitante anônimo).
  comprados: { produtoId: string; quantidade: number }[];
}

/**
 * Baseline de Recomendação Inteligente (PI4-20 / PI4-27), parte pura, sem banco:
 * 1. Filtra produtos indisponíveis (estoqueQtd <= 0).
 * 2. Personaliza com base no histórico do comprador (técnicas e regiões já adquiridas).
 * 3. Fallback / Cold Start com produtos bem avaliados e populares.
 * 4. Explicabilidade: Fornece um motivo amigável para cada item recomendado.
 */
export function rankearRecomendacoes(
  entrada: EntradaRecomendacao,
  limite = 4
): ProdutoRecomendado[] {
  const { produtos } = entrada;
  const avaliacaoPorProduto = new Map(entrada.avaliacoes.map((r) => [r.produtoId, r]));
  const porId = new Map(produtos.map((p) => [p.id, p]));

  // 1. Filtragem de indisponíveis (PI4-82)
  const disponiveis = produtos.filter((p) => p.estoqueQtd > 0);

  // 2. Extração de preferências do histórico do comprador (PI4-83)
  const idsProdutosComprados = new Set<string>();
  const contagemTecnicas = new Map<string, number>();
  const regioesCompradas = new Set<string>();

  for (const item of entrada.comprados) {
    idsProdutosComprados.add(item.produtoId);
    const prod = porId.get(item.produtoId);
    if (prod) {
      contagemTecnicas.set(prod.tecnica, (contagemTecnicas.get(prod.tecnica) ?? 0) + item.quantidade);
      regioesCompradas.add(prod.artesaoRegiao);
    }
  }

  const temHistorico = contagemTecnicas.size > 0;

  // 3. Pontuação de cada produto (Scoring Engine)
  const recomendados: ProdutoRecomendado[] = disponiveis.map((prod) => {
    const av = avaliacaoPorProduto.get(prod.id);
    const mediaAvaliacao = av ? av.media : 4.0;
    const qtdAvaliacoes = av ? av.qtd : 0;

    let score = mediaAvaliacao * 10 + qtdAvaliacoes * 2;
    let motivo = "Destaque do artesanato pernambucano";
    let criterio: CriterioRecomendacao = "popularidade";

    // Recompensa itens recentes (novidade)
    const dataCadastro = new Date(prod.dataCadastro).getTime();
    const dataReferencia = new Date("2025-06-30").getTime();
    const diferencaDias = Math.max(0, (dataReferencia - dataCadastro) / (1000 * 60 * 60 * 24));
    if (diferencaDias < 30) {
      score += 5;
    }

    if (temHistorico) {
      const afinidadeTecnica = contagemTecnicas.get(prod.tecnica) ?? 0;
      const ehMesmaRegiao = regioesCompradas.has(prod.artesaoRegiao);
      const jaComprou = idsProdutosComprados.has(prod.id);

      if (afinidadeTecnica > 0) {
        score += 40 + afinidadeTecnica * 10;
        motivo = `Inspirado no seu apreço por ${prod.tecnica}`;
        criterio = "historico_tecnica";
      } else if (ehMesmaRegiao) {
        score += 25;
        motivo = `Tradição de ${prod.artesaoRegiao}, de onde você já comprou`;
        criterio = "historico_regiao";
      } else if (mediaAvaliacao >= 4.5 && qtdAvaliacoes > 0) {
        score += 15;
        motivo = `Alta recomendação da comunidade (${mediaAvaliacao.toFixed(1)} ★)`;
        criterio = "popularidade";
      }

      // Desprioriza itens que o comprador já comprou para favorecer novas descobertas
      if (jaComprou) {
        score -= 50;
      }
    } else {
      // Cold Start (PI4-84): usuário anônimo ou sem compras
      if (mediaAvaliacao >= 4.5 && qtdAvaliacoes > 0) {
        score += 20;
        motivo = `Mais bem avaliados (${mediaAvaliacao.toFixed(1)} ★)`;
        criterio = "popularidade";
      } else {
        motivo = `Peça artesanal autêntica de ${prod.artesaoRegiao}`;
        criterio = "novidade";
      }
    }

    return { ...prod, score, motivo, criterio };
  });

  // 4. Ordenação decrescente por score e limite
  return recomendados.sort((a, b) => b.score - a.score).slice(0, limite);
}
