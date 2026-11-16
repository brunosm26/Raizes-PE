// Leituras do front nas rotas da PI4-143 (PR #50): GET /api/artesaos (só admin) e GET /api/filtros
// (público). As leituras do catálogo ficam em lib/apiCatalogo.ts.
import { apiFetch } from "./apiUrl";
import type { ArtesaoAdmin, OpcoesFiltros } from "./tipos";

async function lerJson<T>(caminho: string): Promise<T> {
  const resposta = await apiFetch(caminho, { cache: "no-store" });
  if (!resposta.ok) throw new Error(`Falha ao consultar ${caminho} (${resposta.status})`);
  return (await resposta.json()) as T;
}

// Artesãos do banco com nome, região, técnicas, total de produtos e se já têm login.
export function getArtesaosAdmin(): Promise<ArtesaoAdmin[]> {
  return lerJson<ArtesaoAdmin[]>("/api/artesaos");
}

// Técnicas (lista fixa), regiões dos artesãos e categorias dos produtos.
export function getOpcoesFiltros(): Promise<OpcoesFiltros> {
  return lerJson<OpcoesFiltros>("/api/filtros");
}
