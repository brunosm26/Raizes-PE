import { executorPadrao } from "./transacao";

// Acesso à tabela origem.artesao.

export async function buscarIdPorUsuario(usuarioId: string): Promise<string | null> {
  const { rows } = await executorPadrao().query<{ id: string }>(
    `SELECT id FROM origem.artesao WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows[0]?.id ?? null;
}

export interface DadosArtesao {
  id: string;
  nome: string;
  regiaoOrigem: string;
  biografia: string;
}

export async function buscarPorId(id: string): Promise<DadosArtesao | null> {
  const { rows } = await executorPadrao().query<DadosArtesao>(
    `SELECT a.id, u.nome,
            COALESCE(a.regiao_origem, '') AS "regiaoOrigem",
            COALESCE(a.biografia, '')     AS biografia
       FROM origem.artesao a
       JOIN origem.usuario u ON u.id = a.usuario_id
      WHERE a.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}
