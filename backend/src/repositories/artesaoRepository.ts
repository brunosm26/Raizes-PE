import { executorPadrao } from "./transacao";

// Acesso à tabela origem.artesao.

export async function buscarIdPorUsuario(usuarioId: string): Promise<string | null> {
  const { rows } = await executorPadrao().query<{ id: string }>(
    `SELECT id FROM origem.artesao WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows[0]?.id ?? null;
}
