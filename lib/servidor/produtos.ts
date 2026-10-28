// Escrita de produtos (painel do artesão) no PostgreSQL. Só roda no servidor.
import { pool } from "@/lib/db";
import { ehUuid, resolverId } from "@/lib/idsLegados";
import { buscarProduto } from "@/lib/servidor/catalogo";
import type { DadosSessao } from "@/lib/sessao";
import type { ProdutoComArtesao, Tecnica } from "@/lib/tipos";

export class ErroProduto extends Error {
  constructor(mensagem: string, public status = 400) {
    super(mensagem);
  }
}

const TECNICAS: Tecnica[] = ["Cerâmica", "Têxtil", "Madeira", "Renda e Bordado", "Palha"];
const MAX_IMAGEM = 2_800_000; // data URL de ~2 MB (mesmo limite do banco)

interface CamposEditaveis {
  nome: string;
  descricao: string;
  preco: number;
  estoqueQtd: number;
  imagemUrl: string | null;
}

function validarCampos(bruto: Record<string, unknown>): CamposEditaveis {
  const nome = String(bruto.nome ?? "").trim();
  const descricao = String(bruto.descricao ?? "").trim();
  const preco = Number(bruto.preco);
  const estoqueQtd = Number(bruto.estoqueQtd);
  const imagem = typeof bruto.imagemUrl === "string" && bruto.imagemUrl ? bruto.imagemUrl : null;

  if (!nome || nome.length > 150) throw new ErroProduto("Informe um nome de até 150 caracteres.");
  if (!descricao) throw new ErroProduto("Informe a descrição do produto.");
  if (!Number.isFinite(preco) || preco <= 0 || preco >= 100_000_000) {
    throw new ErroProduto("Informe um preço válido.");
  }
  if (!Number.isInteger(estoqueQtd) || estoqueQtd < 0 || estoqueQtd > 1_000_000) {
    throw new ErroProduto("Informe um estoque válido.");
  }
  if (imagem) {
    const ok = /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imagem) || /^(https?:\/\/|\/)/.test(imagem);
    if (!ok) throw new ErroProduto("Formato de imagem inválido.");
    if (imagem.length > MAX_IMAGEM) throw new ErroProduto("A imagem precisa ter até 2MB.");
  }
  return { nome, descricao, preco: Math.round(preco * 100) / 100, estoqueQtd, imagemUrl: imagem };
}

export async function criarProduto(
  usuarioIdBruto: string,
  bruto: Record<string, unknown>
): Promise<ProdutoComArtesao> {
  const usuarioId = resolverId(String(usuarioIdBruto ?? ""));
  if (!ehUuid(usuarioId)) throw new ErroProduto("Artesão inválido.");
  const campos = validarCampos(bruto);

  const tecnica = String(bruto.tecnica ?? "") as Tecnica;
  if (!TECNICAS.includes(tecnica)) throw new ErroProduto("Escolha uma técnica válida.");
  const categoria = String(bruto.categoria ?? "").trim();
  if (!categoria || categoria.length > 100) throw new ErroProduto("Informe uma categoria.");

  const { rows: artesaos } = await pool.query<{ id: string }>(
    `SELECT id FROM origem.artesao WHERE usuario_id = $1`,
    [usuarioId]
  );
  if (artesaos.length === 0) throw new ErroProduto("Artesão não encontrado.", 404);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO origem.produto
            (artesao_id, nome, descricao, tecnica, categoria, preco, estoque_qtd, imagem_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      artesaos[0].id,
      campos.nome,
      campos.descricao,
      tecnica,
      categoria,
      campos.preco,
      campos.estoqueQtd,
      campos.imagemUrl,
    ]
  );
  const criado = await buscarProduto(rows[0].id);
  if (!criado) throw new ErroProduto("Produto não encontrado.", 404);
  return criado;
}

export async function editarProduto(
  idBruto: string,
  bruto: Record<string, unknown>,
  sessao: DadosSessao
): Promise<ProdutoComArtesao> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) throw new ErroProduto("Produto não encontrado.", 404);
  const campos = validarCampos(bruto);

  // Só o dono da loja (ou o admin) altera o produto.
  const { rows: donos } = await pool.query<{ usuarioId: string }>(
    `SELECT a.usuario_id AS "usuarioId"
       FROM origem.produto p JOIN origem.artesao a ON a.id = p.artesao_id
      WHERE p.id = $1`,
    [id]
  );
  if (donos.length === 0) throw new ErroProduto("Produto não encontrado.", 404);
  if (sessao.tipo !== "admin" && donos[0].usuarioId !== sessao.id) {
    throw new ErroProduto("Este produto pertence a outro artesão.", 403);
  }

  const { rowCount } = await pool.query(
    `UPDATE origem.produto
        SET nome = $2, descricao = $3, preco = $4, estoque_qtd = $5, imagem_url = $6
      WHERE id = $1`,
    [id, campos.nome, campos.descricao, campos.preco, campos.estoqueQtd, campos.imagemUrl]
  );
  if (!rowCount) throw new ErroProduto("Produto não encontrado.", 404);
  const atualizado = await buscarProduto(id);
  if (!atualizado) throw new ErroProduto("Produto não encontrado.", 404);
  return atualizado;
}
