import type { TipoUsuario, UsuarioAutenticado } from "../types/dominio";
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

export async function buscarPorEmail(
  email: string
): Promise<(UsuarioAutenticado & { senhaHash: string | null }) | null> {
  const { rows } = await executorPadrao().query<UsuarioAutenticado & { senhaHash: string | null }>(
    `SELECT id, nome, tipo, senha_hash AS "senhaHash"
       FROM origem.usuario WHERE lower(email) = lower($1)`,
    [email]
  );
  return rows[0] ?? null;
}

// Lança ErroEmailDuplicado se o e-mail já existe (violação de unicidade).
export class ErroEmailDuplicado extends Error {}

export async function inserirComprador(nome: string, email: string, senhaHash: string): Promise<UsuarioAutenticado> {
  try {
    const { rows } = await executorPadrao().query<UsuarioAutenticado>(
      `INSERT INTO origem.usuario (nome, email, tipo, senha_hash)
       VALUES ($1, $2, 'comprador', $3)
       RETURNING id, nome, tipo`,
      [nome, email, senhaHash]
    );
    return rows[0]!;
  } catch (erro) {
    if ((erro as { code?: string }).code === "23505") throw new ErroEmailDuplicado();
    throw erro;
  }
}
