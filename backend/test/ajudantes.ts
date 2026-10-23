import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { TipoUsuario } from "../src/types/dominio";

// Os testes que gravam no banco só rodam com TEST_DATABASE_URL apontando para um banco
// DESCARTÁVEL (nunca o Neon do time): eles criam pedidos e produtos.
export const bancoDeTeste = process.env.TEST_DATABASE_URL;
export const semBanco = bancoDeTeste ? false : "defina TEST_DATABASE_URL (banco descartável) para rodar";

process.env.DATABASE_URL = bancoDeTeste ?? "";
process.env.SESSION_SECRET ??= "segredo-de-teste-com-mais-de-32-caracteres";
process.env.NODE_ENV = "test";

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
  const { app } = await import("../src/app");
  const { fecharPool } = await import("../src/config/db");
  const { COOKIE_SESSAO, criarToken } = await import("../src/utils/tokenSessao");
  const servidor: Server = await new Promise((ok) => {
    const s = app.listen(0, () => ok(s));
  });
  const { port } = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/api`,
    fechar: async () => {
      await new Promise((ok) => servidor.close(ok));
      await fecharPool();
    },
    cookie: async (usuario) => `${COOKIE_SESSAO}=${criarToken(usuario)}`,
  };
}

export function json(corpo: unknown, cookie?: string): RequestInit {
  return {
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(corpo),
  };
}
