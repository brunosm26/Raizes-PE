import type { CookieOptions, Request, RequestHandler, Response } from "express";
import { env } from "../config/env";
import * as authService from "../services/authService";
import { validarSessao } from "../services/sessaoService";
import type { UsuarioAutenticado } from "../types/dominio";
import { lerCookie } from "../utils/cookies";
import { COOKIE_SESSAO, criarToken, DURACAO_SESSAO_SEG } from "../utils/tokenSessao";

const OPCOES_COOKIE: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
};

async function gravarSessao(res: Response, usuario: UsuarioAutenticado): Promise<void> {
  res.cookie(COOKIE_SESSAO, await criarToken(usuario), { ...OPCOES_COOKIE, maxAge: DURACAO_SESSAO_SEG * 1000 });
}

// Mesmo critério da versão no Next: primeiro IP do x-forwarded-for (proxy do deploy).
function ipDe(req: Request): string {
  const encaminhado = req.headers["x-forwarded-for"];
  const primeiro = (Array.isArray(encaminhado) ? encaminhado[0] : encaminhado)?.split(",")[0]?.trim();
  return primeiro || "local";
}

// POST /api/auth/login  { email, senha, perfil? }
export const login: RequestHandler = async (req, res) => {
  const usuario = await authService.entrar(req.body ?? {}, ipDe(req));
  await gravarSessao(res, usuario);
  res.json({ usuario });
};

// POST /api/auth/cadastro  { nome, email, senha } → cria um comprador e já entra
export const cadastro: RequestHandler = async (req, res) => {
  const usuario = await authService.cadastrarComprador(req.body ?? {});
  await gravarSessao(res, usuario);
  res.status(201).json({ usuario });
};

// POST /api/auth/logout
export const logout: RequestHandler = (_req, res) => {
  res.cookie(COOKIE_SESSAO, "", { path: "/", maxAge: 0 });
  res.json({ ok: true });
};

// GET /api/auth/me → { usuario: { id, nome, tipo } | null }. Nunca falha: sem banco,
// responde como visitante (a barra de navegação depende disso).
export const eu: RequestHandler = async (req, res) => {
  try {
    const sessao = await validarSessao(lerCookie(req.headers.cookie, COOKIE_SESSAO));
    res.json({ usuario: sessao ? { id: sessao.id, nome: sessao.nome, tipo: sessao.tipo } : null });
  } catch (erro) {
    console.error("GET /api/auth/me", erro);
    res.json({ usuario: null });
  }
};
