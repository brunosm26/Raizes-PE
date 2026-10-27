import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

// Client Prisma único do backend, criado só no primeiro uso. Assim o servidor sobe
// (e a rota /api/saude responde) mesmo sem DATABASE_URL, e nada conecta no build.
let cliente: PrismaClient | undefined;

export function obterPrisma(): PrismaClient {
  if (cliente) return cliente;

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada. Veja backend/.env.example.");
  }

  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // O Neon "dorme" quando ocioso; sem limite, o pg esperaria para sempre.
    connectionTimeoutMillis: 10_000,
  });
  cliente = new PrismaClient({ adapter });
  return cliente;
}

export async function desconectarPrisma(): Promise<void> {
  if (!cliente) return;
  await cliente.$disconnect();
  cliente = undefined;
}
