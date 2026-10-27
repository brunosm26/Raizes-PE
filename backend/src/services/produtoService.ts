import * as artesaoRepository from "../repositories/artesaoRepository";
import * as produtoRepository from "../repositories/produtoRepository";
import { TECNICAS, type DadosSessao, type ProdutoComArtesao, type Tecnica } from "../types/dominio";
import { ErroHttp } from "../utils/erroHttp";
import { ehUuid, resolverId } from "../utils/ids";

// Regras de escrita de produto (painel do artesão): validação dos campos e dono da loja.

const MAX_IMAGEM = 2_800_000; // data URL de ~2 MB (mesmo limite do banco)

function validarCampos(bruto: Record<string, unknown>): produtoRepository.CamposEditaveis {
  const nome = String(bruto.nome ?? "").trim();
  const descricao = String(bruto.descricao ?? "").trim();
  const preco = Number(bruto.preco);
  const estoqueQtd = Number(bruto.estoqueQtd);
  const imagem = typeof bruto.imagemUrl === "string" && bruto.imagemUrl ? bruto.imagemUrl : null;

  if (!nome || nome.length > 150) throw new ErroHttp(400, "Informe um nome de até 150 caracteres.");
  if (!descricao) throw new ErroHttp(400, "Informe a descrição do produto.");
  if (!Number.isFinite(preco) || preco <= 0 || preco >= 100_000_000) {
    throw new ErroHttp(400, "Informe um preço válido.");
  }
  if (!Number.isInteger(estoqueQtd) || estoqueQtd < 0 || estoqueQtd > 1_000_000) {
    throw new ErroHttp(400, "Informe um estoque válido.");
  }
  if (imagem) {
    const ok = /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imagem) || /^(https?:\/\/|\/)/.test(imagem);
    if (!ok) throw new ErroHttp(400, "Formato de imagem inválido.");
    if (imagem.length > MAX_IMAGEM) throw new ErroHttp(400, "A imagem precisa ter até 2MB.");
  }
  return { nome, descricao, preco: Math.round(preco * 100) / 100, estoqueQtd, imagemUrl: imagem };
}

export async function criarProduto(
  usuarioIdBruto: string,
  bruto: Record<string, unknown>
): Promise<ProdutoComArtesao> {
  const usuarioId = resolverId(String(usuarioIdBruto ?? ""));
  if (!ehUuid(usuarioId)) throw new ErroHttp(400, "Artesão inválido.");
  const campos = validarCampos(bruto);

  const tecnica = String(bruto.tecnica ?? "") as Tecnica;
  if (!TECNICAS.includes(tecnica)) throw new ErroHttp(400, "Escolha uma técnica válida.");
  const categoria = String(bruto.categoria ?? "").trim();
  if (!categoria || categoria.length > 100) throw new ErroHttp(400, "Informe uma categoria.");

  const artesaoId = await artesaoRepository.buscarIdPorUsuario(usuarioId);
  if (!artesaoId) throw new ErroHttp(404, "Artesão não encontrado.");

  const id = await produtoRepository.inserir({ artesaoId, tecnica, categoria, ...campos });
  const criado = await produtoRepository.buscarPorId(id);
  if (!criado) throw new ErroHttp(404, "Produto não encontrado.");
  return criado;
}

export async function editarProduto(
  idBruto: string,
  bruto: Record<string, unknown>,
  sessao: DadosSessao
): Promise<ProdutoComArtesao> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) throw new ErroHttp(404, "Produto não encontrado.");
  const campos = validarCampos(bruto);

  // Só o dono da loja (ou o admin) altera o produto.
  const dono = await produtoRepository.buscarUsuarioDono(id);
  if (!dono) throw new ErroHttp(404, "Produto não encontrado.");
  if (sessao.tipo !== "admin" && dono !== sessao.id) {
    throw new ErroHttp(403, "Este produto pertence a outro artesão.");
  }

  if (!(await produtoRepository.atualizar(id, campos))) throw new ErroHttp(404, "Produto não encontrado.");
  const atualizado = await produtoRepository.buscarPorId(id);
  if (!atualizado) throw new ErroHttp(404, "Produto não encontrado.");
  return atualizado;
}
