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

// Remove acentos para permitir busca sem diferenciar "ceramica" de "cerâmica".
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

// GET /produtos?tecnica=...&regiao=...&categoria=...&q=...
export async function getProdutos(
  tecnica?: Tecnica,
  busca?: string,
  regiao?: string,
  categoria?: string
): Promise<ProdutoComArtesao[]> {
  let filtrados = tecnica ? produtos.filter((p) => p.tecnica === tecnica) : produtos;

  if (categoria) {
    filtrados = filtrados.filter((p) => p.categoria === categoria);
  }

  if (regiao) {
    filtrados = filtrados.filter((p) => regiaoDoArtesao(p.artesaoId) === regiao);
  }

  const termo = busca?.trim();
  if (termo) {
    const q = normalizar(termo);
    filtrados = filtrados.filter((p) => {
      const artesaoNome = nomeDoArtesao(p.artesaoId);
      const regiaoDoProduto = regiaoDoArtesao(p.artesaoId);
      return (
        normalizar(p.nome).includes(q) ||
        normalizar(p.tecnica).includes(q) ||
        normalizar(p.categoria).includes(q) ||
        normalizar(artesaoNome).includes(q) ||
        normalizar(regiaoDoProduto).includes(q)
      );
    });
  }

  return atraso(filtrados.map(paraProdutoComArtesao));
}

// GET /produtos/:id
export async function getProdutoPorId(id: string): Promise<ProdutoComArtesao | undefined> {
  const produto = produtos.find((p) => p.id === id);
  return atraso(produto ? paraProdutoComArtesao(produto) : undefined);
}

// GET /produtos/:id/relacionados — mesma técnica, excluindo o próprio produto
export async function getProdutosRelacionados(produtoId: string, limite = 3): Promise<ProdutoComArtesao[]> {
  const produto = produtos.find((p) => p.id === produtoId);
  if (!produto) return atraso([]);
  const relacionados = produtos
    .filter((p) => p.id !== produtoId && p.tecnica === produto.tecnica)
    .slice(0, limite)
    .map(paraProdutoComArtesao);
  return atraso(relacionados);
}

// GET /produtos/:id/avaliacoes/resumo
export async function getResumoAvaliacoes(produtoId: string): Promise<ResumoAvaliacoes> {
  const doProduto = avaliacoes.filter((a) => a.produtoId === produtoId);
  if (doProduto.length === 0) return atraso({ media: 0, quantidade: 0 });
  const soma = doProduto.reduce((acc, a) => acc + a.nota, 0);
  return atraso({ media: soma / doProduto.length, quantidade: doProduto.length });
}

// GET /artesaos/:id — perfil público
export async function getPerfilArtesao(artesaoId: string): Promise<PerfilArtesao | undefined> {
  const artesao = artesaos.find((a) => a.id === artesaoId);
  if (!artesao) return atraso(undefined);
  const usuario = usuarios.find((u) => u.id === artesao.usuarioId);
  const produtosDoArtesao = produtos.filter((p) => p.artesaoId === artesaoId).map(paraProdutoComArtesao);

  return atraso({
    id: artesao.id,
    nome: usuario?.nome ?? "Artesão desconhecido",
    regiaoOrigem: artesao.regiaoOrigem,
    biografia: artesao.biografia,
    produtos: produtosDoArtesao,
  });
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
