import { CaixaNotificacoes, type CaixaDoUsuario } from "../utils/notificacoesPedido";
import { ErroHttp } from "../utils/erroHttp";

// Caixa de notificações por usuário. Quem escreve é o worker da fila (filaAssincronaService);
// aqui ficam só as leituras e a marcação de lidas que as rotas usam.
export const caixaNotificacoes = new CaixaNotificacoes();

const MAX_IDS_POR_MARCACAO = 100;

export function listarDoUsuario(usuarioId: string): CaixaDoUsuario {
  return caixaNotificacoes.listar(usuarioId);
}

// Sem `ids`, marca todas as do usuário. Ids de outro usuário não mudam nada.
export function marcarComoLidas(usuarioId: string, idsEntrada: unknown): { marcadas: number; naoLidas: number } {
  const ids = validarIds(idsEntrada);
  const marcadas = caixaNotificacoes.marcarComoLidas(usuarioId, ids);
  return { marcadas, naoLidas: caixaNotificacoes.listar(usuarioId).naoLidas };
}

function validarIds(ids: unknown): string[] | undefined {
  if (ids === undefined) return undefined;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || id.length === 0 || id.length > 64)) {
    throw new ErroHttp(400, "ids precisa ser uma lista de identificadores de notificação.");
  }
  if (ids.length > MAX_IDS_POR_MARCACAO) {
    throw new ErroHttp(400, `Marque no máximo ${MAX_IDS_POR_MARCACAO} notificações por vez.`);
  }
  return ids as string[];
}
