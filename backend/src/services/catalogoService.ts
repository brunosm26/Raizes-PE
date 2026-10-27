import * as artesaoRepository from "../repositories/artesaoRepository";
import * as avaliacaoRepository from "../repositories/avaliacaoRepository";
import * as produtoRepository from "../repositories/produtoRepository";
import type { PerfilArtesao, ProdutoComArtesao, ResumoAvaliacoes } from "../types/dominio";
import { ehUuid, resolverId } from "../utils/ids";

// Leitura do catálogo (vitrine, página do produto, perfil do artesão).
// Ids inválidos viram "não encontrado" (null ou lista vazia), nunca erro 500.

// Remove acentos para permitir busca sem diferenciar "ceramica" de "cerâmica".
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function limitar(valor: unknown, padrao: number, maximo = 20): number {
  const n = typeof valor === "string" ? Number.parseInt(valor, 10) : Number.NaN;
  return Number.isNaN(n) ? padrao : Math.min(Math.max(n, 1), maximo);
}

export async function listarProdutos(filtros: {
  tecnica?: string;
  busca?: string;
  regiao?: string;
  categoria?: string;
}): Promise<ProdutoComArtesao[]> {
  const produtos = await produtoRepository.listar(filtros);

  // A busca por texto ignora acentos; com poucos produtos é feita aqui para não
  // depender de extensão do banco (unaccent).
  const termo = filtros.busca?.trim();
  if (!termo) return produtos;
  const q = normalizar(termo);
  return produtos.filter(
    (p) =>
      normalizar(p.nome).includes(q) ||
      normalizar(p.tecnica).includes(q) ||
      normalizar(p.categoria).includes(q) ||
      normalizar(p.artesaoNome).includes(q) ||
      normalizar(p.artesaoRegiao).includes(q)
  );
}

export async function buscarProduto(idBruto: string): Promise<ProdutoComArtesao | null> {
  const id = resolverId(idBruto);
  return ehUuid(id) ? produtoRepository.buscarPorId(id) : null;
}

export async function listarRelacionados(idBruto: string, limite: number): Promise<ProdutoComArtesao[]> {
  const id = resolverId(idBruto);
  return ehUuid(id) ? produtoRepository.listarRelacionados(id, limite) : [];
}

export async function resumirAvaliacoes(idBruto: string): Promise<ResumoAvaliacoes> {
  const id = resolverId(idBruto);
  return ehUuid(id) ? avaliacaoRepository.resumirDoProduto(id) : { media: 0, quantidade: 0 };
}

export async function buscarPerfilArtesao(idBruto: string): Promise<PerfilArtesao | null> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) return null;
  const artesao = await artesaoRepository.buscarPorId(id);
  if (!artesao) return null;
  return { ...artesao, produtos: await produtoRepository.listarDoArtesao(id) };
}
