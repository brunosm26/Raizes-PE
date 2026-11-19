import type { PedidoComItens } from "../types/dominio";
import { FilaAssincrona, type JobPublico, type ResumoFila } from "../utils/filaAssincrona";
import {
  itensPorArtesao,
  notificacaoDeStatus,
  notificacoesDoPedidoCriado,
  type CaixaNotificacoes,
} from "../utils/notificacoesPedido";
import { cacheCatalogo, chaveRecomendacoes } from "./cacheCatalogo";
import { caixaNotificacoes } from "./notificacaoService";
import { calcularRecomendacoes } from "./recomendacaoService";

// Processamento assíncrono dos pedidos. Os controllers enfileiram depois do COMMIT e respondem
// na hora; o worker roda no próximo giro do event loop:
//   pedido.criado            → avisa o comprador, avisa cada artesão com o resumo pronto para o
//                              WhatsApp e recalcula as recomendações do comprador (cache quente)
//   pedido.status_atualizado → avisa o comprador do novo status
// Erro aqui nunca chega à resposta HTTP: o job tenta de novo e, se esgotar, fica em "erro".

export const TIPO_PEDIDO_CRIADO = "pedido.criado";
export const TIPO_STATUS_ATUALIZADO = "pedido.status_atualizado";

// Mesmo limite que a vitrine pede (components/SecaoRecomendados.tsx).
const LIMITE_RECOMENDACOES_VITRINE = 4;

export interface DependenciasProcessadores {
  caixa: CaixaNotificacoes;
  preaquecerRecomendacoes: (compradorId: string) => Promise<void>;
}

async function preaquecerRecomendacoes(compradorId: string): Promise<void> {
  // O controller já apagou o cache antes de enfileirar; esta leitura é MISS e guarda o resultado,
  // então a próxima visita do comprador à vitrine já sai da memória (X-Cache: HIT).
  await cacheCatalogo.lerOuCalcular(chaveRecomendacoes(compradorId, LIMITE_RECOMENDACOES_VITRINE), () =>
    calcularRecomendacoes(compradorId, LIMITE_RECOMENDACOES_VITRINE)
  );
}

export function registrarProcessadores(fila: FilaAssincrona, deps: DependenciasProcessadores): void {
  fila.registrar<PedidoComItens>(TIPO_PEDIDO_CRIADO, async (pedido) => {
    // Avisos antes do recálculo: se o recálculo falhar, a nova tentativa não duplica (chave por pedido).
    for (const aviso of notificacoesDoPedidoCriado(pedido)) deps.caixa.registrar(aviso);
    await deps.preaquecerRecomendacoes(pedido.compradorId);
  });

  fila.registrar<PedidoComItens>(TIPO_STATUS_ATUALIZADO, async (pedido, job) => {
    const aviso = notificacaoDeStatus(pedido, job.id);
    if (aviso) deps.caixa.registrar(aviso);
  });
}

export const filaAssincrona = new FilaAssincrona();
registrarProcessadores(filaAssincrona, { caixa: caixaNotificacoes, preaquecerRecomendacoes });

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

export function resumirFila(): ResumoFila {
  return filaAssincrona.resumo();
}
