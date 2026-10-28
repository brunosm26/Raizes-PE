import { Pool } from "pg";
import { env } from "./env";

// Pool único do PostgreSQL, criado na primeira consulta. Só os repositories usam.
let pool: Pool | undefined;

export function obterPool(): Pool {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL não definida. Copie a connection string do Neon para backend/.env.");
  }
  pool ??= new Pool({ connectionString: env.DATABASE_URL });
  return pool;
}

export async function fecharPool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
