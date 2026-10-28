import * as usuarioRepository from "../repositories/usuarioRepository";
import type { DadosSessao } from "../types/dominio";
import { lerToken } from "../utils/tokenSessao";

// Sessão da requisição: confere a assinatura do cookie E se o usuário ainda existe com o
// mesmo perfil (se o perfil mudou ou a conta sumiu, a sessão deixa de valer).
export async function validarSessao(token: string | undefined): Promise<DadosSessao | null> {
  const dados = await lerToken(token);
  if (!dados) return null;
  const usuario = await usuarioRepository.buscarNomeETipo(dados.id);
  if (!usuario || usuario.tipo !== dados.tipo) return null;
  return { ...dados, nome: usuario.nome };
}
