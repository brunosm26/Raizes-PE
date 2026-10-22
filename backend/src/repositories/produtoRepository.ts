import type { ProdutoComArtesao, Tecnica } from "../types/dominio";
import { executorPadrao, type Executor } from "./transacao";

// Acesso à tabela origem.produto (com artesão e usuário juntados).

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

export async function buscarPorId(id: string): Promise<ProdutoComArtesao | null> {
  const { rows } = await executorPadrao().query<LinhaProduto>(`${SELECT_PRODUTO} WHERE p.id = $1`, [id]);
  return rows[0] ? paraProduto(rows[0]) : null;
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
}

// Trava as linhas (FOR UPDATE) para duas compras simultâneas não estourarem o estoque.
// Só faz sentido dentro de uma transação.
export async function travarParaCompra(ids: string[], tx: Executor): Promise<ProdutoParaCompra[]> {
  const { rows } = await tx.query<ProdutoParaCompra>(
    `SELECT id, nome, preco::text AS preco, estoque_qtd AS estoque
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
