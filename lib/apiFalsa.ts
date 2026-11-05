import { apiFetch } from "./apiUrl";
import {
  usuarios,
  artesaos,
  produtos,
  pedidos,
  itensPedido,
  avaliacoes,
} from "./dadosFalsos";
import {
  Artesao,
  Avaliacao,
  EstatisticasPainel,
  ItemPedido,
  Pedido,
  PerfilArtesao,
  Produto,
  ProdutoComArtesao,
  ResumoAvaliacoes,
  Tecnica,
  Usuario,
} from "./tipos";

// Simula latência de rede, como uma API real teria.
function atraso<T>(valor: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ms));
}

function nomeDoArtesao(artesaoId: string): string {
  const artesao = artesaos.find((a) => a.id === artesaoId);
  const usuario = artesao ? usuarios.find((u) => u.id === artesao.usuarioId) : undefined;
  return usuario?.nome ?? "Artesão desconhecido";
}

function regiaoDoArtesao(artesaoId: string): string {
  const artesao = artesaos.find((a) => a.id === artesaoId);
  return artesao?.regiaoOrigem ?? "";
}

function paraProdutoComArtesao(p: (typeof produtos)[number]): ProdutoComArtesao {
  return {
    ...p,
    artesaoNome: nomeDoArtesao(p.artesaoId),
    artesaoRegiao: regiaoDoArtesao(p.artesaoId),
  };
}

// --- Catálogo da vitrine: lido do PostgreSQL pelas rotas /api (app/api/...) -------------
// As telas continuam chamando estas mesmas funções; só a origem dos dados mudou.

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

// GET /artesaos/:usuarioId/produtos — usado pelo painel do próprio artesão logado
export async function getProdutosDoArtesao(usuarioId: string): Promise<ProdutoComArtesao[]> {
  const artesao = artesaos.find((a) => a.usuarioId === usuarioId);
  if (!artesao) return atraso([]);
  const doArtesao = produtos.filter((p) => p.artesaoId === artesao.id);
  return atraso(doArtesao.map(paraProdutoComArtesao));
}

// GET /artesaos/:usuarioId/estatisticas
export async function getEstatisticasPainel(usuarioId: string): Promise<EstatisticasPainel> {
  const artesao = artesaos.find((a) => a.usuarioId === usuarioId);
  const produtosDoArtesao = artesao ? produtos.filter((p) => p.artesaoId === artesao.id) : [];
  const idsProdutos = new Set(produtosDoArtesao.map((p) => p.id));

  const itensDoArtesao = itensPedido.filter((i) => idsProdutos.has(i.produtoId));
  const pedidosDoArtesao = pedidos.filter((ped) =>
    itensDoArtesao.some((i) => i.pedidoId === ped.id)
  );

  const vendasDoMes = itensDoArtesao.reduce((soma, i) => soma + i.quantidade * i.precoUnitario, 0);
  const pedidosPendentes = pedidosDoArtesao.filter((p) => p.status === "pendente").length;

  const historicoMensal = [
    { mes: "Fev", faturamento: 1120, pedidos: 4 },
    { mes: "Mar", faturamento: 1450, pedidos: 5 },
    { mes: "Abr", faturamento: 1380, pedidos: 4 },
    { mes: "Mai", faturamento: 1890, pedidos: 7 },
    { mes: "Jun", faturamento: 2150, pedidos: 8 },
    { mes: "Jul", faturamento: 2580, pedidos: 10 },
  ];

  const vendasPorTecnica = [
    { tecnica: "Têxtil", totalVendido: 1720, porcentagem: 67 },
    { tecnica: "Renda e Bordado", totalVendido: 540, porcentagem: 21 },
    { tecnica: "Palha", totalVendido: 320, porcentagem: 12 },
  ];

  return atraso({
    vendasDoMes,
    vendasDeltaPct: 12,
    pedidosPendentes,
    visitasNoPerfil: 128,
    visitasDeltaPct: 5,
    historicoMensal,
    vendasPorTecnica,
  });
}

// GET /artesaos — lista crua, sem juntar com usuários. Usado por telas que precisam
// resolver nome/técnicas por conta própria (painel admin) em vez de um recorte pronto
// como getPerfilArtesao/getProdutosDoArtesao.
export async function getArtesaos(): Promise<Artesao[]> {
  return atraso(artesaos);
}

// GET /usuarios — lista crua. Usado junto com getArtesaos() para resolver nome do
// artesão fora dos recortes prontos (ex.: tabela de Gestão de Artesãos do admin).
export async function getUsuarios(): Promise<Usuario[]> {
  return atraso(usuarios);
}

// GET /produtos (sem filtro, sem juntar artesão) — semente usada por contextos que
// combinam produtos do mock com os criados localmente pelo artesão.
export async function getProdutosBase(): Promise<Produto[]> {
  return atraso(produtos);
}

// GET /pedidos — lista crua, sem juntar comprador/itens. Usado pelo contexto de pedidos
// pra montar o histórico (mock + criados no app) sem importar dadosFalsos diretamente.
export async function getPedidos(): Promise<Pedido[]> {
  return atraso(pedidos);
}

// GET /itensPedido — lista crua, usada junto com getPedidos()/getProdutosBase() pra
// resolver os itens de cada pedido.
export async function getItensPedido(): Promise<ItemPedido[]> {
  return atraso(itensPedido);
}

// GET /avaliacoes — lista completa (sem filtro por produto), usada pelo motor de
// recomendação, que precisa cruzar avaliações de todos os produtos de uma vez.
export async function getAvaliacoesTodas(): Promise<Avaliacao[]> {
  return atraso(avaliacoes);
}

export const tecnicas: Tecnica[] = ["Cerâmica", "Têxtil", "Madeira", "Renda e Bordado", "Palha"];

export const regioes: string[] = Array.from(new Set(artesaos.map((a) => a.regiaoOrigem))).sort();

export const categorias: string[] = Array.from(new Set(produtos.map((p) => p.categoria))).sort();
