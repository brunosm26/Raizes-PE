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
): Promise<(UsuarioAutenticado & { senhaHash: string | null; aprovado: boolean | null }) | null> {
  const { rows } = await executorPadrao().query<UsuarioAutenticado & { senhaHash: string | null; aprovado: boolean | null }>(
    `SELECT u.id, u.nome, u.tipo, u.senha_hash AS "senhaHash", a.aprovado
       FROM origem.usuario u
       LEFT JOIN origem.artesao a ON a.usuario_id = u.id
      WHERE lower(u.email) = lower($1)`,
    [email]
  );
  return rows[0] ?? null;
}

// Lança ErroEmailDuplicado se o e-mail já existe (violação de unicidade).
export class ErroEmailDuplicado extends Error {}

export async function inserirContaPublica(
  nome: string,
  email: string,
  senhaHash: string,
  perfil: "comprador" | "artesao"
): Promise<UsuarioAutenticado> {
  try {
    const { rows } = await executorPadrao().query<UsuarioAutenticado>(
      `WITH conta AS (
         INSERT INTO origem.usuario (nome, email, tipo, senha_hash)
         VALUES ($1, $2, $4, $3)
         RETURNING id, nome, tipo
       ), perfil_artesao AS (
         INSERT INTO origem.artesao (usuario_id, aprovado)
         SELECT id, false FROM conta WHERE tipo = 'artesao'
       )
       SELECT id, nome, tipo FROM conta`,
      [nome, email, senhaHash, perfil]
    );
    return rows[0]!;
  } catch (erro) {
    if ((erro as { code?: string }).code === "23505") throw new ErroEmailDuplicado();
    throw erro;
  }
}
