import type { Request, RequestHandler } from "express";
import { validarSessao } from "../services/sessaoService";
import type { DadosSessao, TipoUsuario } from "../types/dominio";
import { lerCookie } from "../utils/cookies";
import { ErroHttp } from "../utils/erroHttp";
import { COOKIE_SESSAO } from "../utils/tokenSessao";

// Lê o cookie de sessão e anexa em req.sessao (null = visitante). Não bloqueia.
export const carregarSessao: RequestHandler = async (req, _res, next) => {
  req.sessao = await validarSessao(lerCookie(req.headers.cookie, COOKIE_SESSAO));
  next();
};

// Exige login (e, opcionalmente, um dos perfis). Responde 401/403 pelo tratador de erros.
export function exigirSessao(perfis?: readonly TipoUsuario[]): RequestHandler {
  return async (req, _res, next) => {
    const sessao = await validarSessao(lerCookie(req.headers.cookie, COOKIE_SESSAO));
    if (!sessao) throw new ErroHttp(401, "Faça login para continuar.");
    if (perfis && !perfis.includes(sessao.tipo)) {
      throw new ErroHttp(403, "Seu perfil não tem permissão para esta ação.");
    }
    req.sessao = sessao;
    next();
  };
}

// Sessão já garantida por exigirSessao, para os controllers não repetirem a checagem.
export function sessaoDe(req: Request): DadosSessao {
  if (!req.sessao) throw new ErroHttp(401, "Faça login para continuar.");
  return req.sessao;
}
