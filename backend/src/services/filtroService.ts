import * as artesaoRepository from "../repositories/artesaoRepository";
import * as produtoRepository from "../repositories/produtoRepository";
import { TECNICAS, type OpcoesFiltros } from "../types/dominio";
import { normalizarOpcoes } from "../utils/ordenacao";

// Opções dos filtros da vitrine (GET /api/filtros). As técnicas são a lista fixa do domínio;
// regiões e categorias saem do que está cadastrado (D1 da PI4-143: categorias derivadas dos
// produtos), sem vazias nem repetidas e em ordem alfabética pt-BR.
export async function obterOpcoes(): Promise<OpcoesFiltros> {
  const [regioes, categorias] = await Promise.all([artesaoRepository.listarRegioes(), produtoRepository.listarCategorias()]);
  return { tecnicas: [...TECNICAS], regioes: normalizarOpcoes(regioes), categorias: normalizarOpcoes(categorias) };
}
