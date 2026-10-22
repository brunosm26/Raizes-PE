import * as avaliacaoRepository from "../repositories/avaliacaoRepository";
import * as pedidoRepository from "../repositories/pedidoRepository";
import * as produtoRepository from "../repositories/produtoRepository";
import { ehUuid, resolverId } from "../utils/ids";
import { rankearRecomendacoes, type ProdutoRecomendado } from "./rankingRecomendacao";

// Busca os dados da recomendação nos repositories e entrega à regra de pontuação
// (rankingRecomendacao.ts), que não depende do banco.
export async function calcularRecomendacoes(
  compradorIdBruto: string | undefined,
  limite: number
): Promise<ProdutoRecomendado[]> {
  const compradorId = compradorIdBruto ? resolverId(compradorIdBruto) : undefined;

  const [produtos, avaliacoes, comprados] = await Promise.all([
    produtoRepository.listar({}),
    avaliacaoRepository.resumirPorProduto(),
    compradorId && ehUuid(compradorId) ? pedidoRepository.somarCompradosPorProduto(compradorId) : [],
  ]);

  return rankearRecomendacoes({ produtos, avaliacoes, comprados }, limite);
}
