// Opções dos filtros da vitrine (GET /api/filtros) no fallback do Next, sem API_URL.
// Mesmo SQL e mesmo contrato do Express (backend/src/services/filtroService.ts): técnicas da
// lista fixa; regiões dos artesãos e categorias dos produtos (D1 da PI4-143), sem vazias nem
// repetidas e em ordem alfabética pt-BR.
import { pool } from "@/lib/db";
import { normalizarOpcoes } from "@/lib/servidor/ordenacao";
import { TECNICAS, type OpcoesFiltros } from "@/lib/tipos";

export const SQL_REGIOES = `SELECT DISTINCT a.regiao_origem AS valor
  FROM origem.artesao a JOIN origem.usuario u ON u.id = a.usuario_id
  WHERE a.regiao_origem IS NOT NULL AND u.ativo`;
export const SQL_CATEGORIAS = `SELECT DISTINCT p.categoria AS valor
  FROM origem.produto p
  JOIN origem.artesao a ON a.id = p.artesao_id
  JOIN origem.usuario u ON u.id = a.usuario_id
  WHERE p.categoria IS NOT NULL AND p.ativo AND u.ativo`;

async function valores(sql: string): Promise<string[]> {
  const { rows } = await pool.query<{ valor: string }>(sql);
  return rows.map((r) => r.valor);
}

export async function obterOpcoesFiltros(): Promise<OpcoesFiltros> {
  const [regioes, categorias] = await Promise.all([valores(SQL_REGIOES), valores(SQL_CATEGORIAS)]);
  return { tecnicas: [...TECNICAS], regioes: normalizarOpcoes(regioes), categorias: normalizarOpcoes(categorias) };
}
