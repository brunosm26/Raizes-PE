import type { ProdutoComArtesao, Tecnica } from "../types/dominio";
import { executorPadrao, type Executor } from "./transacao";

// Acesso à tabela origem.produto (com artesão e usuário juntados).

const selecionarProduto = (incluirRejeicao = false) => `
  SELECT p.id,
         p.artesao_id                        AS "artesaoId",
         p.nome,
         COALESCE(p.descricao, '')           AS descricao,
         p.tecnica,
         COALESCE(p.categoria, '')           AS categoria,
         p.preco::float8                     AS preco,
         p.status_curadoria                  AS "statusCuradoria",
         p.estoque_qtd                       AS "estoqueQtd",
         to_char(p.data_cadastro, 'YYYY-MM-DD') AS "dataCadastro",
         p.imagem_url                        AS "imagemUrl",
         u.nome                              AS "artesaoNome",
         u.id                                AS "artesaoUsuarioId",
         COALESCE(a.regiao_origem, '')       AS "artesaoRegiao"${incluirRejeicao ? `,
         CASE WHEN p.rejeicao_justificativa IS NOT NULL THEN jsonb_build_object(
           'justificativa', p.rejeicao_justificativa, 'autorId', p.rejeicao_autor_id, 'data', p.rejeicao_em
         ) END AS "rejeicaoCuradoria"` : ""}
    FROM origem.produto p
    JOIN origem.artesao a ON a.id = p.artesao_id
    JOIN origem.usuario u ON u.id = a.usuario_id`;

const PRODUTO_PUBLICADO = "p.status_curadoria = 'aprovado'";

type LinhaProduto = Omit<ProdutoComArtesao, "imagemUrl" | "rejeicaoCuradoria"> & {
  imagemUrl: string | null;
  rejeicaoCuradoria?: ProdutoComArtesao["rejeicaoCuradoria"] | null;
};

// O front trata imagemUrl como opcional (undefined), então null sai do objeto.
function paraProduto(linha: LinhaProduto): ProdutoComArtesao {
  const { imagemUrl, rejeicaoCuradoria, ...produto } = linha;
  return {
    ...produto,
    ...(imagemUrl ? { imagemUrl } : {}),
    ...(rejeicaoCuradoria ? { rejeicaoCuradoria } : {}),
  };
}

export async function buscarPorId(id: string, incluirNaoPublicados = false, incluirRejeicao = false): Promise<ProdutoComArtesao | null> {
  const filtro = incluirNaoPublicados ? "" : ` AND ${PRODUTO_PUBLICADO}`;
  const { rows } = await executorPadrao().query<LinhaProduto>(`${selecionarProduto(incluirRejeicao)} WHERE p.id = $1${filtro}`, [id]);
  return rows[0] ? paraProduto(rows[0]) : null;
}

// O controller resolve o escopo de gestão a partir da sessão. Sem usuário, é admin.
export async function listarParaGestao(usuarioId?: string): Promise<ProdutoComArtesao[]> {
  const where = usuarioId ? "WHERE a.usuario_id = $1" : "";
  const { rows } = await executorPadrao().query<LinhaProduto>(
    `${selecionarProduto(!usuarioId)} ${where} ORDER BY p.data_cadastro DESC, p.nome`,
    usuarioId ? [usuarioId] : []
  );
  return rows.map(paraProduto);
}

// Usuário dono da loja do produto (null se o produto não existe).
export async function buscarUsuarioDono(id: string): Promise<string | null> {
  const { rows } = await executorPadrao().query<{ usuarioId: string }>(
    `SELECT a.usuario_id AS "usuarioId"
       FROM origem.produto p JOIN origem.artesao a ON a.id = p.artesao_id
      WHERE p.id = $1`,
    [id]
  );
  return rows[0]?.usuarioId ?? null;
}

export interface NovoProduto {
  artesaoId: string;
  nome: string;
  descricao: string;
  tecnica: Tecnica;
  categoria: string;
  preco: number;
  estoqueQtd: number;
  imagemUrl: string | null;
}

export async function inserir(produto: NovoProduto): Promise<string> {
  const { rows } = await executorPadrao().query<{ id: string }>(
    `INSERT INTO origem.produto
            (artesao_id, nome, descricao, tecnica, categoria, preco, estoque_qtd, imagem_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      produto.artesaoId,
      produto.nome,
      produto.descricao,
      produto.tecnica,
      produto.categoria,
      produto.preco,
      produto.estoqueQtd,
      produto.imagemUrl,
    ]
  );
  return rows[0]!.id;
}

export type CamposEditaveis = Pick<NovoProduto, "nome" | "descricao" | "preco" | "estoqueQtd" | "imagemUrl">;

// Devolve false se o produto não existe.
export async function atualizar(id: string, campos: CamposEditaveis): Promise<boolean> {
  const { rowCount } = await executorPadrao().query(
    `UPDATE origem.produto
        SET nome = $2, descricao = $3, preco = $4, estoque_qtd = $5, imagem_url = $6
      WHERE id = $1`,
    [id, campos.nome, campos.descricao, campos.preco, campos.estoqueQtd, campos.imagemUrl]
  );
  return Boolean(rowCount);
}

export interface ProdutoParaCompra {
  id: string;
  nome: string;
  preco: string; // texto, para não perder centavos no float
  estoque: number;
  statusCuradoria: ProdutoComArtesao["statusCuradoria"];
}

// Trava as linhas (FOR UPDATE) para duas compras simultâneas não estourarem o estoque.
// Só faz sentido dentro de uma transação.
export async function travarParaCompra(ids: string[], tx: Executor): Promise<ProdutoParaCompra[]> {
  const { rows } = await tx.query<ProdutoParaCompra>(
    `SELECT id, nome, preco::text AS preco, estoque_qtd AS estoque, status_curadoria AS "statusCuradoria"
       FROM origem.produto
      WHERE id = ANY($1::uuid[])
      ORDER BY id
      FOR UPDATE`,
    [ids]
  );
  return rows;
}

export async function baixarEstoque(id: string, quantidade: number, tx: Executor): Promise<void> {
  await tx.query(`UPDATE origem.produto SET estoque_qtd = estoque_qtd - $2 WHERE id = $1`, [id, quantidade]);
}

export interface FiltrosProduto {
  tecnica?: string;
  regiao?: string;
  categoria?: string;
}

export async function listar(filtros: FiltrosProduto): Promise<ProdutoComArtesao[]> {
  const condicoes: string[] = [PRODUTO_PUBLICADO];
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
  const where = `WHERE ${condicoes.join(" AND ")}`;

  const { rows } = await executorPadrao().query<LinhaProduto>(
    `${selecionarProduto()} ${where} ORDER BY p.data_cadastro DESC, p.nome`,
    valores
  );
  return rows.map(paraProduto);
}

// Mesma técnica do produto, excluindo ele mesmo (RF-01).
export async function listarRelacionados(id: string, limite: number): Promise<ProdutoComArtesao[]> {
  const { rows } = await executorPadrao().query<LinhaProduto>(
    `${selecionarProduto()}
      WHERE ${PRODUTO_PUBLICADO}
        AND p.id <> $1
        AND p.tecnica = (
          SELECT tecnica FROM origem.produto WHERE id = $1 AND status_curadoria = 'aprovado'
        )
      ORDER BY p.data_cadastro DESC, p.nome
      LIMIT $2`,
    [id, limite]
  );
  return rows.map(paraProduto);
}

// Categorias cadastradas, cruas: o service tira espaços, vazias e repetidas e ordena (D1 da
// PI4-143: as categorias vêm dos produtos, não de uma tabela própria).
export const SQL_CATEGORIAS = `SELECT DISTINCT categoria AS valor FROM origem.produto WHERE categoria IS NOT NULL AND status_curadoria = 'aprovado'`;

export async function listarCategorias(): Promise<string[]> {
  const { rows } = await executorPadrao().query<{ valor: string }>(SQL_CATEGORIAS);
  return rows.map((r) => r.valor);
}

export async function listarDoArtesao(artesaoId: string): Promise<ProdutoComArtesao[]> {
  const { rows } = await executorPadrao().query<LinhaProduto>(
    `${selecionarProduto()} WHERE p.artesao_id = $1 AND ${PRODUTO_PUBLICADO} ORDER BY p.data_cadastro DESC, p.nome`,
    [artesaoId]
  );
  return rows.map(paraProduto);
}

export async function decidirCuradoria(
  id: string,
  status: "aprovado" | "rejeitado",
  justificativa: string | null,
  autorId: string
): Promise<void> {
  await executorPadrao().query(
    `UPDATE origem.produto
        SET status_curadoria = $2,
            rejeicao_justificativa = $3,
            rejeicao_autor_id = CASE WHEN $3::varchar IS NOT NULL THEN $4::uuid END,
            rejeicao_em = CASE WHEN $3::varchar IS NOT NULL THEN CURRENT_TIMESTAMP END
      WHERE id = $1 AND status_curadoria = 'pendente'`,
    [id, status, justificativa, autorId]
  );
}
