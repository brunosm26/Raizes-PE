// Leituras públicas do catálogo pelo front: vitrine, página do produto e perfil do artesão.
// Chamam as rotas /api (Express com API_URL; sem ela, as rotas de app/api do Next), que leem
// do PostgreSQL. Antes ficavam junto dos dados de exemplo removidos na PI4-144; a assinatura
// e o comportamento são os mesmos (tests/catalogo.test.mjs).
import { apiFetch } from "./apiUrl";
import type { PerfilArtesao, ProdutoComArtesao, ResumoAvaliacoes, Tecnica } from "./tipos";

// Lê JSON de uma rota interna. 404 vira undefined (a tela mostra "não encontrado");
// qualquer outro erro é lançado, e a tela mostra a mensagem de erro com "tentar de novo".
async function buscarJson<T>(url: string): Promise<T | undefined> {
  const resposta = await apiFetch(url, { cache: "no-store" });
  if (resposta.status === 404) return undefined;
  if (!resposta.ok) throw new Error(`Falha ao consultar ${url} (${resposta.status})`);
  return (await resposta.json()) as T;
}

// GET /api/produtos?tecnica=...&regiao=...&categoria=...&busca=...
export async function getProdutos(
  tecnica?: Tecnica,
  busca?: string,
  regiao?: string,
  categoria?: string
): Promise<ProdutoComArtesao[]> {
  const parametros = new URLSearchParams();
  if (tecnica) parametros.set("tecnica", tecnica);
  if (busca?.trim()) parametros.set("busca", busca.trim());
  if (regiao) parametros.set("regiao", regiao);
  if (categoria) parametros.set("categoria", categoria);
  const texto = parametros.toString();
  return (await buscarJson<ProdutoComArtesao[]>(`/api/produtos${texto ? `?${texto}` : ""}`)) ?? [];
}

// GET /api/produtos/:id
export async function getProdutoPorId(id: string): Promise<ProdutoComArtesao | undefined> {
  return buscarJson<ProdutoComArtesao>(`/api/produtos/${encodeURIComponent(id)}`);
}

// GET /api/produtos/:id/relacionados — mesma técnica, excluindo o próprio produto
export async function getProdutosRelacionados(produtoId: string, limite = 3): Promise<ProdutoComArtesao[]> {
  return (
    (await buscarJson<ProdutoComArtesao[]>(
      `/api/produtos/${encodeURIComponent(produtoId)}/relacionados?limite=${limite}`
    )) ?? []
  );
}

// GET /api/produtos/:id/avaliacoes
export async function getResumoAvaliacoes(produtoId: string): Promise<ResumoAvaliacoes> {
  return (
    (await buscarJson<ResumoAvaliacoes>(`/api/produtos/${encodeURIComponent(produtoId)}/avaliacoes`)) ?? {
      media: 0,
      quantidade: 0,
    }
  );
}

// GET /api/artesaos/:id — perfil público
export async function getPerfilArtesao(artesaoId: string): Promise<PerfilArtesao | undefined> {
  return buscarJson<PerfilArtesao>(`/api/artesaos/${encodeURIComponent(artesaoId)}`);
}

