// Cookie de sessão assinado (HMAC-SHA256). Usa só Web Crypto, então roda tanto nas rotas
// da API (Node) quanto no middleware (Edge). O cookie guarda quem é o usuário e o perfil;
// a assinatura impede o navegador de forjar ou alterar esses dados.
import type { TipoUsuario } from "./tipos";

export const COOKIE_SESSAO = "raizes_sessao";
export const DURACAO_SESSAO_SEG = 60 * 60 * 24 * 7; // 7 dias

export interface DadosSessao {
  id: string; // UUID do usuário
  nome: string;
  tipo: TipoUsuario;
  exp: number; // epoch em segundos
}

const TIPOS: TipoUsuario[] = ["comprador", "artesao", "admin"];
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function segredo(): string {
  const valor = process.env.SESSION_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error(
      "SESSION_SECRET ausente ou curto demais. Defina no .env.local um valor aleatório de 32+ caracteres."
    );
  }
  return valor;
}

async function chaveHmac(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(segredo()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function paraBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(texto: string) {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function criarToken(
  usuario: Omit<DadosSessao, "exp">,
  duracaoSeg = DURACAO_SESSAO_SEG
): Promise<string> {
  const dados: DadosSessao = { ...usuario, exp: Math.floor(Date.now() / 1000) + duracaoSeg };
  const corpo = paraBase64Url(encoder.encode(JSON.stringify(dados)));
  const assinatura = await crypto.subtle.sign("HMAC", await chaveHmac(), encoder.encode(corpo));
  return `${corpo}.${paraBase64Url(new Uint8Array(assinatura))}`;
}

// Devolve os dados se a assinatura é válida e o token não expirou; senão null.
export async function lerToken(token: string | undefined | null): Promise<DadosSessao | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  try {
    const valido = await crypto.subtle.verify(
      "HMAC",
      await chaveHmac(),
      deBase64Url(partes[1]),
      encoder.encode(partes[0])
    );
    if (!valido) return null;
    const dados = JSON.parse(decoder.decode(deBase64Url(partes[0]))) as Partial<DadosSessao>;
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

// Quem pode abrir cada área (usado pelo middleware e pela barra de navegação).
export const PERFIS_POR_AREA = {
  pedidos: ["comprador", "admin"],
  checkout: ["comprador"],
  painel: ["artesao", "admin"],
  admin: ["admin"],
} as const satisfies Record<string, readonly TipoUsuario[]>;
