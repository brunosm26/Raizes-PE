import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env";
import type { DadosSessao, TipoUsuario, UsuarioAutenticado } from "../types/dominio";

// Sessão em JWT (HS256, biblioteca jose) guardado no cookie httpOnly "raizes_sessao".
// O MESMO formato é emitido e lido por lib/sessao.ts do front, então o middleware.ts do
// Next aceita o cookie emitido aqui, e vice-versa. O segredo é o SESSION_SECRET.

export const COOKIE_SESSAO = "raizes_sessao";
export const DURACAO_SESSAO_SEG = 60 * 60 * 24 * 7; // 7 dias

// Só HS256: recusa "none" e qualquer outro algoritmo.
const ALGORITMO = "HS256";
const TIPOS: TipoUsuario[] = ["comprador", "artesao", "admin"];

function chave(): Uint8Array {
  const valor = env.SESSION_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curto demais. Defina no backend/.env o mesmo valor aleatório (32+ caracteres) do front."
    );
  }
  return new TextEncoder().encode(valor);
}

// Claims: sub = id do usuário, nome, tipo, iat e exp.
export async function criarToken(usuario: UsuarioAutenticado, duracaoSeg = DURACAO_SESSAO_SEG): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  return new SignJWT({ nome: usuario.nome, tipo: usuario.tipo })
    .setProtectedHeader({ alg: ALGORITMO, typ: "JWT" })
    .setSubject(usuario.id)
    .setIssuedAt(agora)
    .setExpirationTime(agora + duracaoSeg)
    .sign(chave());
}

// Devolve os dados se a assinatura é válida e o token não expirou; senão null (inclusive
// para cookies no formato antigo "corpo.assinatura"). Só lança se o SESSION_SECRET faltar.
export async function lerToken(token: string | undefined | null): Promise<DadosSessao | null> {
  if (!token) return null;
  const segredo = chave();
  try {
    const { payload } = await jwtVerify(token, segredo, {
      algorithms: [ALGORITMO],
      requiredClaims: ["sub", "iat", "exp"],
    });
    const { sub, nome, tipo, exp } = payload;
    if (
      typeof sub !== "string" ||
      typeof nome !== "string" ||
      typeof exp !== "number" ||
      !TIPOS.includes(tipo as TipoUsuario)
    ) {
      return null;
    }
    return { id: sub, nome, tipo: tipo as TipoUsuario, exp };
  } catch {
    return null;
  }
}
