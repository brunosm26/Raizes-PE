import type { PoolClient } from "pg";
import { obterPool } from "../config/db";

// Quem executa a consulta: o pool (fora de transação) ou o client de uma transação.
// Os repositories recebem um Executor opcional para participar de uma transação aberta
// pelo service, sem o service precisar conhecer o pg.
export type Executor = Pick<PoolClient, "query">;

export function executorPadrao(): Executor {
  return obterPool();
}

// Abre uma transação, executa `fn` e faz COMMIT; em qualquer erro faz ROLLBACK e relança.
export async function emTransacao<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
  const client = await obterPool().connect();
  try {
    await client.query("BEGIN");
    const resultado = await fn(client);
    await client.query("COMMIT");
    return resultado;
  } catch (erro) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    client.release();
  }
}
