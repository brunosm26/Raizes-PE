import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import { basename } from "node:path";
import { after, it } from "node:test";
import type { Server } from "node:http";
import type { TipoUsuario } from "../src/types/dominio";
import { conferirBancoDeTeste, urlsDoTime } from "../scripts/travaBanco";

// Os testes que gravam no banco só rodam com TEST_DATABASE_URL apontando para um banco
// DESCARTÁVEL (nunca o Neon do time): eles criam pedidos e produtos. A variável vem só do
// terminal; o backend/.env não é carregado aqui de propósito.
export const bancoDeTeste = process.env.TEST_DATABASE_URL?.trim() || undefined;
export const semBanco = bancoDeTeste ? false : "defina TEST_DATABASE_URL (banco descartável) no terminal para rodar";

// A trava (normalizar URL, comparar com as URLs do time, exigir host local) fica em
// scripts/travaBanco.ts, compartilhada com os scripts de banco descartável (PI4-147).
export { conferirBancoDeTeste, lerArquivoEnv, type UrlDoTime } from "../scripts/travaBanco";

if (bancoDeTeste) {
  conferirBancoDeTeste(bancoDeTeste, urlsDoTime(), process.env.TEST_DB_REMOTO_DESCARTAVEL === "1");
}

process.env.DATABASE_URL = bancoDeTeste ?? "";
process.env.SESSION_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres";
process.env.NODE_ENV = "test";
// Cache do catálogo desligado por padrão: os testes trocam os dados entre uma chamada e outra
// e esperam ver a troca. Quem testa o cache (cacheCatalogo.test.ts) define o TTL antes.
process.env.CACHE_TTL_SEGUNDOS ??= "0";

// Teste que precisa do banco: pulado sem TEST_DATABASE_URL, com um aviso no fim do arquivo
// dizendo quantos foram pulados e como habilitar.
let puladosSemBanco = 0;
export function itComBanco(nome: string, fn: () => Promise<void>): void {
  if (semBanco && puladosSemBanco++ === 0) {
    after(() => {
      console.warn(
        `\n[aviso] ${puladosSemBanco} teste(s) com banco PULADOS em ${basename(process.argv[1] ?? "")}. ` +
          "Para rodar, defina TEST_DATABASE_URL no terminal com um banco DESCARTÁVEL " +
          '(cmd: set TEST_DATABASE_URL=...; PowerShell: $env:TEST_DATABASE_URL="..."). ' +
          "Host remoto exige também TEST_DB_REMOTO_DESCARTAVEL=1.\n"
      );
    });
  }
  it(nome, { skip: semBanco }, fn);
}

// Usuários e produtos fixos da carga db/05_dados_raizes_pe.sql.
export const USUARIOS = {
  comprador: { id: "10000000-0000-4000-8000-000000000007", nome: "Ana Beatriz", tipo: "comprador" },
  artesao: { id: "10000000-0000-4000-8000-000000000002", nome: "Tacaratu", tipo: "artesao" },
  outroArtesao: { id: "10000000-0000-4000-8000-000000000001", nome: "Vitalino", tipo: "artesao" },
  admin: { id: "10000000-0000-4000-8000-000000000009", nome: "Admin", tipo: "admin" },
} as const satisfies Record<string, { id: string; nome: string; tipo: TipoUsuario }>;

export const PRODUTO_DO_ARTESAO = "30000000-0000-4000-8000-000000000002"; // Tapete (Tacaratu)
export const PRODUTO_DE_OUTRO = "30000000-0000-4000-8000-000000000001"; // Vaso (Vitalino)

export interface Api {
  url: string;
  fechar: () => Promise<void>;
  cookie: (usuario: { id: string; nome: string; tipo: TipoUsuario }) => Promise<string>;
}

// Sobe o app numa porta livre. O import é dinâmico para o env acima valer antes.
export async function subirApi(): Promise<Api> {
  const { app } = await import("../src/app.js");
  const { fecharPool } = await import("../src/config/db.js");
  const { COOKIE_SESSAO, criarToken } = await import("../src/utils/tokenSessao.js");
  const servidor: Server = await new Promise((ok) => {
    const s = app.listen(0, () => ok(s));
  });
  // unref: no Node 22, com --test-name-pattern, num arquivo sem teste correspondente o
  // after roda antes de o before terminar, e a API que sobe depois ficaria aberta, prendendo
  // o processo. As requisições em andamento continuam segurando o processo normalmente.
  servidor.unref();
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/api`,
    fechar: async () => {
      await new Promise((ok) => servidor.close(ok));
      await fecharPool();
    },
    cookie: async (usuario) => `${COOKIE_SESSAO}=${await criarToken(usuario)}`,
  };
}

export function json(corpo: unknown, cookie?: string): RequestInit {
  return {
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(corpo),
  };
}

// Token e cookie no formato antigo (antes da PI4-130): "corpo.assinatura" com HMAC-SHA256.
export function tokenFormatoAntigo(): string {
  const corpo = Buffer.from(JSON.stringify({ ...USUARIOS.comprador, exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
    "base64url"
  );
  const assinatura = createHmac("sha256", process.env.SESSION_SECRET as string).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}

export function cookieFormatoAntigo(): string {
  return `raizes_sessao=${tokenFormatoAntigo()}`;
}
