import * as artesaoRepository from "../repositories/artesaoRepository";
import type { ArtesaoAdmin } from "../types/dominio";
import { ErroHttp } from "../utils/erroHttp";
import { compararPtBr } from "../utils/ordenacao";

// Gestão de artesãos pelo admin (GET /api/artesaos).

// Monta o item campo a campo: o que não estiver aqui nunca sai na resposta.
function paraItem(a: ArtesaoAdmin): ArtesaoAdmin {
  return {
    id: a.id,
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

export async function buscarMeuPerfil(usuarioId: string) {
  const perfil = await artesaoRepository.buscarPorUsuario(usuarioId);
  if (!perfil) throw new ErroHttp(404, "Perfil de artesão não encontrado.");
  return perfil;
}

export async function editarMeuPerfil(usuarioId: string, corpo: Record<string, unknown>) {
  const { regiaoOrigem, biografia, fotoUrl } = corpo;
  if (typeof regiaoOrigem !== "string" || regiaoOrigem.trim().length > 100) {
    throw new ErroHttp(400, "Informe uma localidade de até 100 caracteres.");
  }
  if (typeof biografia !== "string" || biografia.trim().length > 3000) {
    throw new ErroHttp(400, "Informe uma biografia de até 3.000 caracteres.");
  }
  if (fotoUrl !== undefined && fotoUrl !== null &&
    (typeof fotoUrl !== "string" || fotoUrl.length > 2_800_000 ||
      !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(fotoUrl))) {
    throw new ErroHttp(400, "Use uma foto JPG, PNG ou WEBP de até 2 MB.");
  }

  const perfil = await artesaoRepository.atualizarPerfil(
    usuarioId, regiaoOrigem.trim(), biografia.trim(), fotoUrl
  );
  if (!perfil) throw new ErroHttp(404, "Perfil de artesão não encontrado.");
  return perfil;
}
