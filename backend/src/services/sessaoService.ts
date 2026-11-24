import * as usuarioRepository from "../repositories/usuarioRepository";
import type { DadosSessao } from "../types/dominio";
import { lerToken } from "../utils/tokenSessao";

// Sessão da requisição: confere a assinatura do cookie E se existe uma conta ativa com o mesmo perfil.
export async function validarSessao(token: string | undefined): Promise<DadosSessao | null> {
  const dados = await lerToken(token);
  if (!dados) return null;
  const usuario = await usuarioRepository.buscarNomeETipo(dados.id);
  if (!usuario || usuario.tipo !== dados.tipo) return null;
  return { ...dados, nome: usuario.nome };
}
