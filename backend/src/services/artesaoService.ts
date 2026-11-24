import * as artesaoRepository from "../repositories/artesaoRepository";
import type { ArtesaoAdmin } from "../types/dominio";
import { compararPtBr } from "../utils/ordenacao";

// Gestão de artesãos pelo admin (GET /api/artesaos).

// Monta o item campo a campo: o que não estiver aqui nunca sai na resposta.
function paraItem(a: ArtesaoAdmin): ArtesaoAdmin {
  return {
    id: a.id,
    ativo: a.ativo === true,
    usuarioId: a.usuarioId,
    nome: a.nome,
    regiaoOrigem: a.regiaoOrigem,
    tecnicas: [...a.tecnicas].sort(compararPtBr),
    totalProdutos: Number(a.totalProdutos),
    temLogin: a.temLogin === true,
    dataCadastro: a.dataCadastro,
  };
}

// Em ordem alfabética do nome (pt-BR); nomes iguais desempatam pelo id, para a ordem ser estável.
export async function listarParaAdmin(): Promise<ArtesaoAdmin[]> {
  const artesaos = await artesaoRepository.listarParaAdmin();
  return artesaos.map(paraItem).sort((x, y) => compararPtBr(x.nome, y.nome) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}
