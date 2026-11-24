import type { ArtesaoAdmin, DadosPublicosArtesao } from "../types/dominio";
import { executorPadrao } from "./transacao";

// Acesso à tabela origem.artesao.

export async function buscarIdPorUsuario(usuarioId: string): Promise<string | null> {
  const { rows } = await executorPadrao().query<{ id: string }>(
    `SELECT id FROM origem.artesao WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows[0]?.id ?? null;
}

const CAMPOS_PERFIL = `a.id, u.nome,
  COALESCE(a.regiao_origem, '') AS "regiaoOrigem",
  COALESCE(a.biografia, '') AS biografia,
  a.foto_url AS "fotoUrl"`;

export async function buscarPorId(id: string): Promise<DadosPublicosArtesao | null> {
  const { rows } = await executorPadrao().query<DadosPublicosArtesao>(
    `SELECT ${CAMPOS_PERFIL}
       FROM origem.artesao a JOIN origem.usuario u ON u.id = a.usuario_id
      WHERE a.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function buscarPorUsuario(usuarioId: string): Promise<DadosPublicosArtesao | null> {
  const { rows } = await executorPadrao().query<DadosPublicosArtesao>(
    `SELECT ${CAMPOS_PERFIL}
       FROM origem.artesao a JOIN origem.usuario u ON u.id = a.usuario_id
      WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  return rows[0] ?? null;
}

export async function atualizarPerfil(
  usuarioId: string,
  regiaoOrigem: string,
  biografia: string,
  fotoUrl: string | null | undefined
): Promise<DadosPublicosArtesao | null> {
  const { rows } = await executorPadrao().query<DadosPublicosArtesao>(
    `UPDATE origem.artesao a
        SET regiao_origem = $2, biografia = $3,
            foto_url = CASE WHEN $4 THEN $5 ELSE a.foto_url END
       FROM origem.usuario u
      WHERE a.usuario_id = $1 AND u.id = a.usuario_id
      RETURNING ${CAMPOS_PERFIL}`,
    [usuarioId, regiaoOrigem, biografia, fotoUrl !== undefined, fotoUrl ?? null]
  );
  return rows[0] ?? null;
}

// Lista do painel do admin (GET /api/artesaos). A ordem por nome em pt-BR fica no service,
// para não depender da collation do banco. temLogin é só o resultado de "senha_hash IS NOT
// NULL": a consulta não devolve o hash nem o e-mail. O lib/servidor/artesaos.ts do Next usa
// o mesmo SQL (conferido pelo tests/rotasAdminFiltros.test.mjs da raiz).
export const SQL_ARTESAOS_ADMIN = `
  SELECT a.id,
         a.usuario_id                           AS "usuarioId",
         u.nome,
         COALESCE(a.regiao_origem, '')          AS "regiaoOrigem",
         COALESCE(array_agg(DISTINCT p.tecnica)
                    FILTER (WHERE p.tecnica IS NOT NULL AND btrim(p.tecnica) <> ''), '{}') AS tecnicas,
         count(p.id)::int                       AS "totalProdutos",
         (u.senha_hash IS NOT NULL)             AS "temLogin",
         to_char(u.data_cadastro, 'YYYY-MM-DD') AS "dataCadastro"
    FROM origem.artesao a
    JOIN origem.usuario u ON u.id = a.usuario_id
    LEFT JOIN origem.produto p ON p.artesao_id = a.id
   GROUP BY a.id, u.id`;

export async function listarParaAdmin(): Promise<ArtesaoAdmin[]> {
  const { rows } = await executorPadrao().query<ArtesaoAdmin>(SQL_ARTESAOS_ADMIN);
  return rows;
}

// Regiões cadastradas, cruas: o service tira espaços, vazias e repetidas e ordena.
export const SQL_REGIOES = `SELECT DISTINCT regiao_origem AS valor FROM origem.artesao WHERE regiao_origem IS NOT NULL`;

export async function listarRegioes(): Promise<string[]> {
  const { rows } = await executorPadrao().query<{ valor: string }>(SQL_REGIOES);
  return rows.map((r) => r.valor);
}
