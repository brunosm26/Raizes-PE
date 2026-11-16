// Gestão de artesãos pelo admin (GET /api/artesaos) no fallback do Next, sem API_URL.
// Mesmo SQL e mesmo contrato do Express (backend/src/repositories/artesaoRepository.ts e
// services/artesaoService.ts), conferidos pelo tests/rotasAdminFiltros.test.mjs.
import { pool } from "@/lib/db";
import { compararPtBr } from "@/lib/servidor/ordenacao";
import type { ArtesaoAdmin } from "@/lib/tipos";

// temLogin é só o resultado de "senha_hash IS NOT NULL": a consulta não devolve o hash nem o e-mail.
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

// Monta o item campo a campo: o que não estiver aqui nunca sai na resposta.
function paraItem(a: ArtesaoAdmin): ArtesaoAdmin {
  return {
    id: a.id,
    usuarioId: a.usuarioId,
    nome: a.nome,
    regiaoOrigem: a.regiaoOrigem,
    tecnicas: [...a.tecnicas].sort(compararPtBr),
    totalProdutos: Number(a.totalProdutos),
    temLogin: a.temLogin === true,
    dataCadastro: a.dataCadastro,
  };
}

// Em ordem alfabética do nome (pt-BR); nomes iguais desempatam pelo id, para a ordem ser estável.
export async function listarArtesaosAdmin(): Promise<ArtesaoAdmin[]> {
  const { rows } = await pool.query<ArtesaoAdmin>(SQL_ARTESAOS_ADMIN);
  return rows.map(paraItem).sort((x, y) => compararPtBr(x.nome, y.nome) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}
