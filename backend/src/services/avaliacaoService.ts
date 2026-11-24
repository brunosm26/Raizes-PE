import * as avaliacaoRepository from "../repositories/avaliacaoRepository";
import { ErroHttp } from "../utils/erroHttp";
import { ehUuid, resolverId } from "../utils/ids";

export async function registrarAvaliacao(idBruto: string, compradorId: string, nota: unknown): Promise<void> {
  const produtoId = resolverId(idBruto);
  if (!ehUuid(produtoId)) throw new ErroHttp(400, "Produto inválido.");
  if (typeof nota !== "number" || !Number.isInteger(nota) || nota < 1 || nota > 5) {
    throw new ErroHttp(400, "Escolha uma nota inteira de 1 a 5.");
  }
  const { permitido, gravada } = await avaliacaoRepository.inserirSeElegivel(produtoId, compradorId, nota);
  if (!permitido) throw new ErroHttp(403, "Você só pode avaliar produtos de pedidos entregues.");
  if (!gravada) throw new ErroHttp(409, "Você já avaliou este produto.");
}
