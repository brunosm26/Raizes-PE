// Gestão de artesãos pelo admin (GET /api/artesaos) no fallback do Next, sem API_URL.
// Mesmo SQL e mesmo contrato do Express (backend/src/repositories/artesaoRepository.ts e
// services/artesaoService.ts), conferidos pelo tests/rotasAdminFiltros.test.mjs.
import { pool } from "@/lib/db";
import { compararPtBr } from "@/lib/servidor/ordenacao";
import type { ArtesaoAdmin, DadosPublicosArtesao } from "@/lib/tipos";

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

export class ErroPerfilArtesao extends Error {}

const CAMPOS_PERFIL = `a.id, u.nome,
  COALESCE(a.regiao_origem, '') AS "regiaoOrigem",
  COALESCE(a.biografia, '') AS biografia,
  a.foto_url AS "fotoUrl"`;

export async function buscarMeuPerfil(usuarioId: string): Promise<DadosPublicosArtesao | null> {
  const { rows } = await pool.query<DadosPublicosArtesao>(
    `SELECT ${CAMPOS_PERFIL}
       FROM origem.artesao a JOIN origem.usuario u ON u.id = a.usuario_id
      WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  return rows[0] ?? null;
}

export async function editarMeuPerfil(
  usuarioId: string, corpo: Record<string, unknown>
): Promise<DadosPublicosArtesao | null> {
  const { regiaoOrigem, biografia, fotoUrl } = corpo;
  if (typeof regiaoOrigem !== "string" || regiaoOrigem.trim().length > 100) {
    throw new ErroPerfilArtesao("Informe uma localidade de até 100 caracteres.");
  }
  if (typeof biografia !== "string" || biografia.trim().length > 3000) {
    throw new ErroPerfilArtesao("Informe uma biografia de até 3.000 caracteres.");
  }
  if (fotoUrl !== undefined && fotoUrl !== null &&
    (typeof fotoUrl !== "string" || fotoUrl.length > 2_800_000 ||
      !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(fotoUrl))) {
    throw new ErroPerfilArtesao("Use uma foto JPG, PNG ou WEBP de até 2 MB.");
  }

  const { rows } = await pool.query<DadosPublicosArtesao>(
    `UPDATE origem.artesao a
        SET regiao_origem = $2, biografia = $3,
            foto_url = CASE WHEN $4 THEN $5 ELSE a.foto_url END
       FROM origem.usuario u
      WHERE a.usuario_id = $1 AND u.id = a.usuario_id
      RETURNING ${CAMPOS_PERFIL}`,
    [usuarioId, regiaoOrigem.trim(), biografia.trim(), fotoUrl !== undefined, fotoUrl ?? null]
  );
  return rows[0] ?? null;
}
