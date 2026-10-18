// Consultas do catálogo (vitrine) ao PostgreSQL. Só roda no servidor (rotas /api).
// Converte as colunas do banco (snake_case, esquema "origem") para os tipos de lib/tipos.ts.
import { pool } from "@/lib/db";
import { ehUuid, resolverId } from "@/lib/idsLegados";
import type {
  PerfilArtesao,
  ProdutoComArtesao,
  ResumoAvaliacoes,
  Tecnica,
} from "@/lib/tipos";

export { ehUuid, resolverId };

const SELECT_PRODUTO = `
  SELECT p.id,
         p.artesao_id                        AS "artesaoId",
         p.nome,
         COALESCE(p.descricao, '')           AS descricao,
         p.tecnica,
         COALESCE(p.categoria, '')           AS categoria,
         p.preco::float8                     AS preco,
         p.estoque_qtd                       AS "estoqueQtd",
         to_char(p.data_cadastro, 'YYYY-MM-DD') AS "dataCadastro",
         p.imagem_url                        AS "imagemUrl",
         u.nome                              AS "artesaoNome",
         u.id                                AS "artesaoUsuarioId",
         COALESCE(a.regiao_origem, '')       AS "artesaoRegiao"
    FROM origem.produto p
    JOIN origem.artesao a ON a.id = p.artesao_id
    JOIN origem.usuario u ON u.id = a.usuario_id`;

type LinhaProduto = Omit<ProdutoComArtesao, "imagemUrl"> & { imagemUrl: string | null };

// O front trata imagemUrl como opcional (undefined), então null sai do objeto.
function paraProduto(linha: LinhaProduto): ProdutoComArtesao {
  const { imagemUrl, ...resto } = linha;
  return imagemUrl ? { ...resto, imagemUrl } : resto;
}

// Remove acentos para permitir busca sem diferenciar "ceramica" de "cerâmica".
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export async function listarProdutos(filtros: {
  tecnica?: Tecnica;
  busca?: string;
  regiao?: string;
  categoria?: string;
}): Promise<ProdutoComArtesao[]> {
  const condicoes: string[] = [];
  const valores: string[] = [];
  if (filtros.tecnica) {
    valores.push(filtros.tecnica);
    condicoes.push(`p.tecnica = $${valores.length}`);
  }
  if (filtros.categoria) {
    valores.push(filtros.categoria);
    condicoes.push(`p.categoria = $${valores.length}`);
  }
  if (filtros.regiao) {
    valores.push(filtros.regiao);
    condicoes.push(`a.regiao_origem = $${valores.length}`);
  }
  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

  const { rows } = await pool.query<LinhaProduto>(
    `${SELECT_PRODUTO} ${where} ORDER BY p.data_cadastro DESC, p.nome`,
    valores
  );
  let produtos = rows.map(paraProduto);

  // A busca por texto ignora acentos; com poucos produtos é feita aqui para não
  // depender de extensão do banco (unaccent).
  const termo = filtros.busca?.trim();
  if (termo) {
    const q = normalizar(termo);
    produtos = produtos.filter(
      (p) =>
        normalizar(p.nome).includes(q) ||
        normalizar(p.tecnica).includes(q) ||
        normalizar(p.categoria).includes(q) ||
        normalizar(p.artesaoNome).includes(q) ||
        normalizar(p.artesaoRegiao).includes(q)
    );
  }
  return produtos;
}

export async function buscarProduto(idBruto: string): Promise<ProdutoComArtesao | null> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) return null;
  const { rows } = await pool.query<LinhaProduto>(`${SELECT_PRODUTO} WHERE p.id = $1`, [id]);
  return rows[0] ? paraProduto(rows[0]) : null;
}

// Mesma técnica do produto, excluindo ele mesmo (RF-01).
export async function listarRelacionados(idBruto: string, limite: number): Promise<ProdutoComArtesao[]> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) return [];
  const { rows } = await pool.query<LinhaProduto>(
    `${SELECT_PRODUTO}
      WHERE p.id <> $1
        AND p.tecnica = (SELECT tecnica FROM origem.produto WHERE id = $1)
      ORDER BY p.data_cadastro DESC, p.nome
      LIMIT $2`,
    [id, limite]
  );
  return rows.map(paraProduto);
}

export async function resumirAvaliacoes(idBruto: string): Promise<ResumoAvaliacoes> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) return { media: 0, quantidade: 0 };
  const { rows } = await pool.query<ResumoAvaliacoes>(
    `SELECT COALESCE(AVG(nota), 0)::float8 AS media,
            COUNT(*)::int                  AS quantidade
       FROM origem.avaliacao
      WHERE produto_id = $1`,
    [id]
  );
  return rows[0];
}

export async function buscarPerfilArtesao(idBruto: string): Promise<PerfilArtesao | null> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) return null;
  const { rows } = await pool.query<{
    id: string;
    nome: string;
    regiaoOrigem: string;
    biografia: string;
  }>(
    `SELECT a.id, u.nome,
            COALESCE(a.regiao_origem, '') AS "regiaoOrigem",
            COALESCE(a.biografia, '')     AS biografia
       FROM origem.artesao a
       JOIN origem.usuario u ON u.id = a.usuario_id
      WHERE a.id = $1`,
    [id]
  );
  if (!rows[0]) return null;

  const { rows: produtos } = await pool.query<LinhaProduto>(
    `${SELECT_PRODUTO} WHERE p.artesao_id = $1 ORDER BY p.data_cadastro DESC, p.nome`,
    [id]
  );
  return { ...rows[0], produtos: produtos.map(paraProduto) };
}
