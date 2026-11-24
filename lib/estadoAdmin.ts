// Moderação de produtos e categorias da administração. As ações demonstrativas de produtos
// ficam no localStorage deste navegador, pelo UUID, com compatibilidade com as chaves do mock.
import { ehUuid, resolverId } from "./idsLegados";

// O que as funções usam do localStorage (o teste passa um dublê em memória).
export interface Armazenamento {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

function lerObjeto(armazenamento: Armazenamento, chave: string): Record<string, unknown> {
  try {
    const salvo: unknown = JSON.parse(armazenamento.getItem(chave) ?? "{}");
    return typeof salvo === "object" && salvo !== null && !Array.isArray(salvo)
      ? (salvo as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// Navegador sem localStorage (aba anônima, cota cheia): o estado vale só enquanto a tela está aberta.
function gravar(armazenamento: Armazenamento, chave: string, valor: unknown): void {
  try {
    armazenamento.setItem(chave, JSON.stringify(valor));
  } catch {
    // segue só em memória
  }
}

function remover(armazenamento: Armazenamento, chave: string): boolean {
  try {
    if (armazenamento.getItem(chave) === null) return false;
    armazenamento.removeItem(chave);
    return true;
  } catch {
    return false;
  }
}

// Converte as chaves para UUID (resolverId) e fica só com as entradas que viram UUID e cujo valor
// é aceito por `converterValor`. `mudou` diz se algo foi convertido ou descartado.
function normalizarMapa<V>(
  bruto: Record<string, unknown>,
  converterValor: (valor: unknown) => V | undefined
): { mapa: Record<string, V>; mudou: boolean } {
  const mapa: Record<string, V> = {};
  let mudou = false;
  for (const [chave, valor] of Object.entries(bruto)) {
    const id = resolverId(chave);
    const convertido = converterValor(valor);
    if (!ehUuid(id) || convertido === undefined) {
      mudou = true;
      continue;
    }
    if (id !== chave || convertido !== valor) mudou = true;
    mapa[id] = convertido;
  }
  return { mapa, mudou };
}

// ---------------------------------------------------------------------------------------------
// Moderação de produtos (/admin/produtos)

export const CHAVE_MODERACAO = "raizes-pe:moderacao-produtos";
// Um produto está "em revisão" se não tem foto ou se foi cadastrado nos últimos 7 dias
// (hoje e os 6 dias anteriores), até o admin aprovar neste navegador.
export const DIAS_EM_REVISAO = 7;

// "oculto" substitui o antigo "removido": o produto sai só da lista do admin, neste navegador.
export type AcaoModeracao = "aprovado" | "oculto";
// produto.id (UUID) -> ação
export type Moderacao = Record<string, AcaoModeracao>;
export type MotivoRevisao = "sem-foto" | "recente";

function converterAcao(valor: unknown): AcaoModeracao | undefined {
  if (valor === "aprovado" || valor === "oculto") return valor;
  if (valor === "removido") return "oculto";
  return undefined;
}

export function lerModeracao(armazenamento: Armazenamento): Moderacao {
  const { mapa, mudou } = normalizarMapa(lerObjeto(armazenamento, CHAVE_MODERACAO), converterAcao);
  if (mudou) gravar(armazenamento, CHAVE_MODERACAO, mapa);
  return mapa;
}

export function salvarModeracao(armazenamento: Armazenamento, moderacao: Moderacao): void {
  gravar(armazenamento, CHAVE_MODERACAO, moderacao);
}

export function moderarProduto(moderacao: Moderacao, produtoId: string, acao: AcaoModeracao): Moderacao {
  const id = resolverId(produtoId);
  return ehUuid(id) ? { ...moderacao, [id]: acao } : moderacao;
}

// Volta a mostrar os ocultos (só os de `produtoIds`, quando informado); as aprovações continuam.
export function reexibirOcultos(moderacao: Moderacao, produtoIds?: readonly string[]): Moderacao {
  const alvo = produtoIds ? new Set(produtoIds.map(resolverId)) : undefined;
  return Object.fromEntries(
    Object.entries(moderacao).filter(([id, acao]) => acao !== "oculto" || (alvo !== undefined && !alvo.has(id)))
  );
}

// "YYYY-MM-DD" (como as rotas devolvem dataCadastro) -> dias desde o cadastro, pela data local
// de `hoje`. Data inválida -> undefined. Negativo quando o servidor já virou o dia e o navegador não.
function diasDesde(dataCadastro: string, hoje: Date): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dataCadastro ?? "");
  if (!m) return undefined;
  const cadastro = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dia = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Number.isNaN(cadastro) ? undefined : Math.round((dia - cadastro) / 86_400_000);
}

// Por que o produto precisa de revisão (antes de qualquer ação do admin), ou null se não precisa.
export function motivoRevisao(
  produto: { imagemUrl?: string | null; dataCadastro: string },
  hoje: Date = new Date()
): MotivoRevisao | null {
  if (!produto.imagemUrl?.trim()) return "sem-foto";
  const dias = diasDesde(produto.dataCadastro, hoje);
  return dias !== undefined && dias < DIAS_EM_REVISAO ? "recente" : null;
}

export function estaEmRevisao(
  produto: { id: string; imagemUrl?: string | null; dataCadastro: string },
  moderacao: Moderacao,
  hoje: Date = new Date()
): boolean {
  return motivoRevisao(produto, hoje) !== null && moderacao[resolverId(produto.id)] !== "aprovado";
}

export function estaOculto(produto: { id: string }, moderacao: Moderacao): boolean {
  return moderacao[resolverId(produto.id)] === "oculto";
}

// ---------------------------------------------------------------------------------------------
// Categorias (/admin/categorias): a lista editável no navegador deu lugar às categorias dos
// produtos (D1). A chave antiga só é apagada.

export const CHAVE_CATEGORIAS_ANTIGA = "raizes-pe:categorias";

export function apagarCategoriasAntigas(armazenamento: Armazenamento): void {
  remover(armazenamento, CHAVE_CATEGORIAS_ANTIGA);
}
