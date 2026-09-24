import {
  getArtesaos,
  getAvaliacoesTodas,
  getItensPedido,
  getPedidos,
  getProdutosBase,
  getUsuarios,
} from "./apiFalsa";
import type { Produto, ProdutoComArtesao, Tecnica } from "./tipos";

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

/**
 * Baseline de Recomendação Inteligente (PI4-20 / PI4-27):
 * 1. Filtra produtos indisponíveis (estoqueQtd <= 0).
 * 2. Personaliza com base no histórico do comprador (técnicas e regiões já adquiridas).
 * 3. Fallback / Cold Start com produtos bem avaliados e populares.
 * 4. Explicabilidade: Fornece um motivo amigável para cada item recomendado.
 *
 * Busca todos os dados pela API fake (lib/apiFalsa.ts) em vez de importar
 * lib/dadosFalsos.ts diretamente — nenhum componente/módulo deve pular a API fake.
 */
export async function calcularRecomendacoes(
  compradorId?: string,
  limite = 4
): Promise<ProdutoRecomendado[]> {
  const [produtos, artesaos, usuarios, pedidos, itensPedido, avaliacoes] = await Promise.all([
    getProdutosBase(),
    getArtesaos(),
    getUsuarios(),
    getPedidos(),
    getItensPedido(),
    getAvaliacoesTodas(),
  ]);

  function nomeDoArtesao(artesaoId: string): string {
    const artesao = artesaos.find((a) => a.id === artesaoId);
    const usuario = artesao ? usuarios.find((u) => u.id === artesao.usuarioId) : undefined;
    return usuario?.nome ?? "Artesão de Pernambuco";
  }

  function regiaoDoArtesao(artesaoId: string): string {
    const artesao = artesaos.find((a) => a.id === artesaoId);
    return artesao?.regiaoOrigem ?? "Pernambuco";
  }

  function paraProdutoComArtesao(p: Produto): ProdutoComArtesao {
    return {
      ...p,
      artesaoNome: nomeDoArtesao(p.artesaoId),
      artesaoRegiao: regiaoDoArtesao(p.artesaoId),
    };
  }

  // 1. Filtragem de indisponíveis (PI4-82)
  const disponiveis = produtos.filter((p) => p.estoqueQtd > 0);

  // 2. Extração de preferências do histórico do comprador (PI4-83)
  const idsProdutosComprados = new Set<string>();
  const contagemTecnicas = new Map<Tecnica, number>();
  const regioesCompradas = new Set<string>();

  if (compradorId) {
    const pedidosDoComprador = pedidos.filter((ped) => ped.compradorId === compradorId);
    const idsPedidos = new Set(pedidosDoComprador.map((ped) => ped.id));

    const itensComprados = itensPedido.filter((item) => idsPedidos.has(item.pedidoId));

    for (const item of itensComprados) {
      idsProdutosComprados.add(item.produtoId);
      const prodOriginal = produtos.find((p) => p.id === item.produtoId);
      if (prodOriginal) {
        contagemTecnicas.set(
          prodOriginal.tecnica,
          (contagemTecnicas.get(prodOriginal.tecnica) ?? 0) + item.quantidade
        );
        regioesCompradas.add(regiaoDoArtesao(prodOriginal.artesaoId));
      }
    }
  }

  const temHistorico = contagemTecnicas.size > 0;

  // 3. Pontuação de cada produto (Scoring Engine)
  const recomendados: ProdutoRecomendado[] = disponiveis.map((prod) => {
    const prodComArtesao = paraProdutoComArtesao(prod);

    // Média de avaliações e popularidade
    const avs = avaliacoes.filter((a) => a.produtoId === prod.id);
    const mediaAvaliacao =
      avs.length > 0 ? avs.reduce((acc, a) => acc + a.nota, 0) / avs.length : 4.0;
    const qtdAvaliacoes = avs.length;

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
      const ehMesmaRegiao = regioesCompradas.has(prodComArtesao.artesaoRegiao);
      const jaComprou = idsProdutosComprados.has(prod.id);

      if (afinidadeTecnica > 0) {
        score += 40 + afinidadeTecnica * 10;
        motivo = `Inspirado no seu apreço por ${prod.tecnica}`;
        criterio = "historico_tecnica";
      } else if (ehMesmaRegiao) {
        score += 25;
        motivo = `Tradição de ${prodComArtesao.artesaoRegiao}, de onde você já comprou`;
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
        motivo = `Peça artesanal autêntica de ${prodComArtesao.artesaoRegiao}`;
        criterio = "novidade";
      }
    }

    return {
      ...prodComArtesao,
      score,
      motivo,
      criterio,
    };
  });

  // 4. Ordenação decrescente por score e limite
  return recomendados.sort((a, b) => b.score - a.score).slice(0, limite);
}
