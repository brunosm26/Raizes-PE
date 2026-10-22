import type { TipoUsuario } from "../types/dominio";
import { executorPadrao, type Executor } from "./transacao";

// Acesso à tabela origem.usuario.

export async function buscarNomeETipo(id: string): Promise<{ nome: string; tipo: TipoUsuario } | null> {
  const { rows } = await executorPadrao().query<{ nome: string; tipo: TipoUsuario }>(
    `SELECT nome, tipo FROM origem.usuario WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function ehComprador(id: string, tx: Executor = executorPadrao()): Promise<boolean> {
  const { rows } = await tx.query(`SELECT 1 FROM origem.usuario WHERE id = $1 AND tipo = 'comprador'`, [id]);
  return rows.length > 0;
}
