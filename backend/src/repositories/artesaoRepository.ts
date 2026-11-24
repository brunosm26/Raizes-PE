import type { ArtesaoAdmin } from "../types/dominio";
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
      WHERE a.id = $1 AND u.ativo`,
    [id]
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
         u.ativo,
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
export const SQL_REGIOES = `SELECT DISTINCT a.regiao_origem AS valor
  FROM origem.artesao a JOIN origem.usuario u ON u.id = a.usuario_id
  WHERE a.regiao_origem IS NOT NULL AND u.ativo`;

export async function listarRegioes(): Promise<string[]> {
  const { rows } = await executorPadrao().query<{ valor: string }>(SQL_REGIOES);
  return rows.map((r) => r.valor);
}
