import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env";
import type { DadosSessao, TipoUsuario, UsuarioAutenticado } from "../types/dominio";

// Cookie de sessão assinado (HMAC-SHA256), no MESMO formato de lib/sessao.ts do front:
// o middleware.ts do Next continua conseguindo ler o cookie emitido aqui.
// A troca por JWT (PI4-130) fica restrita a este arquivo.

export const COOKIE_SESSAO = "raizes_sessao";
export const DURACAO_SESSAO_SEG = 60 * 60 * 24 * 7; // 7 dias

const TIPOS: TipoUsuario[] = ["comprador", "artesao", "admin"];

function segredo(): string {
  const valor = env.SESSION_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curto demais. Defina no backend/.env o mesmo valor aleatório (32+ caracteres) do front."
    );
  }
  return valor;
}

function assinar(corpo: string): Buffer {
  return createHmac("sha256", segredo()).update(corpo).digest();
}

export function criarToken(usuario: UsuarioAutenticado, duracaoSeg = DURACAO_SESSAO_SEG): string {
  const dados: DadosSessao = {
    id: usuario.id,
    nome: usuario.nome,
    tipo: usuario.tipo,
    exp: Math.floor(Date.now() / 1000) + duracaoSeg,
  };
  const corpo = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return `${corpo}.${assinar(corpo).toString("base64url")}`;
}

// Devolve os dados se a assinatura é válida e o token não expirou; senão null.
export function lerToken(token: string | undefined | null): DadosSessao | null {
  if (!token) return null;
  const [corpo, assinatura, ...resto] = token.split(".");
  if (!corpo || !assinatura || resto.length > 0) return null;

  const esperada = assinar(corpo);
  const recebida = Buffer.from(assinatura, "base64url");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as Partial<DadosSessao>;
    if (
      typeof dados.id !== "string" ||
      typeof dados.nome !== "string" ||
      typeof dados.exp !== "number" ||
      !TIPOS.includes(dados.tipo as TipoUsuario) ||
      dados.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return dados as DadosSessao;
  } catch {
    return null;
  }
}
