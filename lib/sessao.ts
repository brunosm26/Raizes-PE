// Sessão em JWT (HS256, biblioteca jose) guardado no cookie httpOnly "raizes_sessao".
// A jose usa só Web Crypto, então roda tanto nas rotas da API (Node) quanto no middleware
// (Edge). O token guarda quem é o usuário e o perfil; a assinatura impede o navegador de
// forjar ou alterar esses dados. O backend Express (backend/src/utils/tokenSessao.ts)
// emite e lê exatamente o mesmo formato, com o mesmo SESSION_SECRET.
import { jwtVerify, SignJWT } from "jose";
import type { TipoUsuario } from "./tipos";

export const COOKIE_SESSAO = "raizes_sessao";
export const DURACAO_SESSAO_SEG = 60 * 60 * 24 * 7; // 7 dias

export interface DadosSessao {
  id: string; // UUID do usuário (claim "sub" do JWT)
  nome: string;
  tipo: TipoUsuario;
  exp: number; // epoch em segundos
}

// Só HS256: recusa "none" e qualquer outro algoritmo.
const ALGORITMO = "HS256";
const TIPOS: TipoUsuario[] = ["comprador", "artesao", "admin"];

function chave(): Uint8Array {
  const valor = process.env.SESSION_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curto demais. Defina no .env.local um valor aleatório de 32+ caracteres."
    );
  }
  return new TextEncoder().encode(valor);
}

// Claims: sub = id do usuário, nome, tipo, iat e exp.
export async function criarToken(
  usuario: Omit<DadosSessao, "exp">,
  duracaoSeg = DURACAO_SESSAO_SEG
): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  return new SignJWT({ nome: usuario.nome, tipo: usuario.tipo })
    .setProtectedHeader({ alg: ALGORITMO, typ: "JWT" })
    .setSubject(usuario.id)
    .setIssuedAt(agora)
    .setExpirationTime(agora + duracaoSeg)
    .sign(chave());
}

// Devolve os dados se a assinatura é válida e o token não expirou; senão null (inclusive
// para cookies no formato antigo "corpo.assinatura" e quando o SESSION_SECRET falta,
// como antes da troca para JWT; o login, que chama criarToken, mostra esse erro).
export async function lerToken(token: string | undefined | null): Promise<DadosSessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), {
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

// Quem pode abrir cada área (usado pelo middleware e pela barra de navegação).
export const PERFIS_POR_AREA = {
  pedidos: ["comprador", "admin"],
  checkout: ["comprador"],
  painel: ["artesao", "admin"],
  admin: ["admin"],
} as const satisfies Record<string, readonly TipoUsuario[]>;
