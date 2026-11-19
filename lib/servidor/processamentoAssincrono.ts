// Fila assíncrona e notificações no fallback do Next (sem API_URL). Mesmos jobs, mesmas
// mensagens e mesmo contrato do Express (backend/src/services/filaAssincronaService.ts).
// filaAssincrona.ts e notificacoesPedido.ts são cópias de backend/src/utils
// (tests/filaNext.test.mjs confere que não divergem).
// Atenção: em hospedagem serverless cada instância tem a sua memória, então a fila só é
// confiável com um processo único (next dev / next start). A demonstração usa o Express.
import { calcularRecomendacoes } from "@/lib/motorRecomendacao";
import { cacheCatalogo, chaveRecomendacoes } from "@/lib/servidor/cacheCatalogo";
import { FilaAssincrona, type JobPublico, type ResumoFila } from "@/lib/servidor/filaAssincrona";
import {
  CaixaNotificacoes,
  itensPorArtesao,
  notificacaoDeStatus,
  notificacoesDoPedidoCriado,
  type CaixaDoUsuario,
} from "@/lib/servidor/notificacoesPedido";
import type { PedidoComItens } from "@/lib/tipos";

export const TIPO_PEDIDO_CRIADO = "pedido.criado";
export const TIPO_STATUS_ATUALIZADO = "pedido.status_atualizado";

const LIMITE_RECOMENDACOES_VITRINE = 4;
const MAX_IDS_POR_MARCACAO = 100;

export class ErroNotificacao extends Error {
  readonly status = 400;
}

function criarFila(caixa: CaixaNotificacoes): FilaAssincrona {
  const fila = new FilaAssincrona();
  fila.registrar<PedidoComItens>(TIPO_PEDIDO_CRIADO, async (pedido) => {
    for (const aviso of notificacoesDoPedidoCriado(pedido)) caixa.registrar(aviso);
    await cacheCatalogo.lerOuCalcular(chaveRecomendacoes(pedido.compradorId, LIMITE_RECOMENDACOES_VITRINE), () =>
      calcularRecomendacoes(pedido.compradorId, LIMITE_RECOMENDACOES_VITRINE)
    );
  });
  fila.registrar<PedidoComItens>(TIPO_STATUS_ATUALIZADO, async (pedido, job) => {
    const aviso = notificacaoDeStatus(pedido, job.id);
    if (aviso) caixa.registrar(aviso);
  });
  return fila;
}

// Uma só fila entre os recarregamentos do modo de desenvolvimento, como o cache e o pool.
const g = globalThis as unknown as { caixaNotificacoes?: CaixaNotificacoes; filaAssincrona?: FilaAssincrona };

export const caixaNotificacoes = g.caixaNotificacoes ?? new CaixaNotificacoes();
export const filaAssincrona = g.filaAssincrona ?? criarFila(caixaNotificacoes);

if (process.env.NODE_ENV !== "production") {
  g.caixaNotificacoes = caixaNotificacoes;
  g.filaAssincrona = filaAssincrona;
}

// O pedido já está gravado quando estas funções rodam: se enfileirar falhar, o checkout não pode
// responder erro por isso. O problema vai para o log e a resposta segue (null = não enfileirou).
function enfileirarSemDerrubar(tipo: string, pedido: PedidoComItens, envolvidos: () => string[]): JobPublico | null {
  try {
    return filaAssincrona.enfileirar(tipo, pedido, { referencia: pedido.id, envolvidos: envolvidos() });
  } catch (erro) {
    console.error(`[fila] não foi possível enfileirar ${tipo} do pedido ${pedido?.id}:`, erro);
    return null;
  }
}

export function enfileirarPedidoCriado(pedido: PedidoComItens): JobPublico | null {
  return enfileirarSemDerrubar(TIPO_PEDIDO_CRIADO, pedido, () => [pedido.compradorId, ...itensPorArtesao(pedido).keys()]);
}

export function enfileirarStatusAtualizado(pedido: PedidoComItens): JobPublico | null {
  return enfileirarSemDerrubar(TIPO_STATUS_ATUALIZADO, pedido, () => [pedido.compradorId]);
}

export function listarNotificacoes(usuarioId: string): CaixaDoUsuario {
  return caixaNotificacoes.listar(usuarioId);
}

export function resumirFila(): ResumoFila {
  return filaAssincrona.resumo();
}

export function marcarComoLidas(usuarioId: string, ids: unknown): { marcadas: number; naoLidas: number } {
  if (ids !== undefined) {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || id.length === 0 || id.length > 64)) {
      throw new ErroNotificacao("ids precisa ser uma lista de identificadores de notificação.");
    }
    if (ids.length > MAX_IDS_POR_MARCACAO) {
      throw new ErroNotificacao(`Marque no máximo ${MAX_IDS_POR_MARCACAO} notificações por vez.`);
    }
  }
  const marcadas = caixaNotificacoes.marcarComoLidas(usuarioId, ids as string[] | undefined);
  return { marcadas, naoLidas: caixaNotificacoes.listar(usuarioId).naoLidas };
}
