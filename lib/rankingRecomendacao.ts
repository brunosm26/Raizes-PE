import type { ProdutoComArtesao } from "./tipos";

// Constantes de pontuação do sistema de recomendações
const PESO_MEDIA_AVALIACAO = 10;
const PESO_QUANTIDADE_AVALIACOES = 2;
const BONUS_TECNICA = 40;
const PESO_AFINIDADE_TECNICA = 10;
const BONUS_REGIAO = 25;
const BONUS_ALTA_AVALIACAO = 15;
const BONUS_COLD_START = 20;
const PENALIDADE_COMPRA = 50;
const NOTA_MINIMA_ALTA_AVALIACAO = 4.5;
const NOTA_PADRAO_SEM_AVALIACOES = 4.0;
const DIAS_PARA_NOVIDADE = 30;
const BONUS_NOVIDADE = 5;

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
 * Baseline de Recomendação Inteligente (PI4-20 / PI4-27) — parte pura, sem banco:
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
    const mediaAvaliacao = av ? av.media : NOTA_PADRAO_SEM_AVALIACOES;
    const qtdAvaliacoes = av ? av.qtd : 0;

    let score = mediaAvaliacao * PESO_MEDIA_AVALIACAO
      + qtdAvaliacoes * PESO_QUANTIDADE_AVALIACOES;
    let motivo = "Destaque do artesanato pernambucano";
    let criterio: CriterioRecomendacao = "popularidade";

    // Recompensa itens recentes (novidade)
    const dataCadastro = new Date(prod.dataCadastro).getTime();
    const dataReferencia = new Date("2025-06-30").getTime();
    const diferencaDias = Math.max(0, (dataReferencia - dataCadastro) / (1000 * 60 * 60 * 24));
    if (diferencaDias < DIAS_PARA_NOVIDADE) {
      score += BONUS_NOVIDADE;
    }

    if (temHistorico) {
      const afinidadeTecnica = contagemTecnicas.get(prod.tecnica) ?? 0;
      const ehMesmaRegiao = regioesCompradas.has(prod.artesaoRegiao);
      const jaComprou = idsProdutosComprados.has(prod.id);

      if (afinidadeTecnica > 0) {
        score += BONUS_TECNICA + afinidadeTecnica * PESO_AFINIDADE_TECNICA;
        motivo = `Inspirado no seu apreço por ${prod.tecnica}`;
        criterio = "historico_tecnica";
      } else if (ehMesmaRegiao) {
        score += BONUS_REGIAO;
        motivo = `Tradição de ${prod.artesaoRegiao}, de onde você já comprou`;
        criterio = "historico_regiao";
      } else if (mediaAvaliacao >= NOTA_MINIMA_ALTA_AVALIACAO && qtdAvaliacoes > 0) {
        score += BONUS_ALTA_AVALIACAO;
        motivo = `Alta recomendação da comunidade (${mediaAvaliacao.toFixed(1)} ★)`;
        criterio = "popularidade";
      }

      // Desprioriza itens que o comprador já comprou para favorecer novas descobertas
      if (jaComprou) {
        score -= PENALIDADE_COMPRA;
      }
    } else {
      // Cold Start (PI4-84): usuário anônimo ou sem compras
      if (mediaAvaliacao >= NOTA_MINIMA_ALTA_AVALIACAO && qtdAvaliacoes > 0) {
        score += BONUS_COLD_START;
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
