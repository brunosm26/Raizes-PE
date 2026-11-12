import * as pedidoRepository from "../repositories/pedidoRepository";
import * as produtoRepository from "../repositories/produtoRepository";
import { emTransacao } from "../repositories/transacao";
import * as usuarioRepository from "../repositories/usuarioRepository";
import { STATUS_PEDIDO, type DadosSessao, type PedidoComItens, type StatusPedido } from "../types/dominio";
import { ErroHttp } from "../utils/erroHttp";
import { ehUuid, resolverId } from "../utils/ids";
import { assinaturaItens, idDoPedido } from "../utils/idempotenciaPedido";

// Regras de pedido: quem enxerga o quê, validação do carrinho, estoque, total e
// quem pode mudar o status.

// Cada perfil enxerga só o que é seu: comprador → os próprios pedidos;
// artesão → pedidos com produtos dele; admin → todos.
export function listarParaSessao(sessao: DadosSessao): Promise<PedidoComItens[]> {
  if (sessao.tipo === "admin") return pedidoRepository.listarTodos();
  if (sessao.tipo === "artesao") return pedidoRepository.listarDoArtesao(sessao.id);
  return pedidoRepository.listarDoComprador(sessao.id);
}

// Junta linhas repetidas do mesmo produto e valida as quantidades.
function validarItens(itensEntrada: unknown): Map<string, number> {
  if (!Array.isArray(itensEntrada) || itensEntrada.length === 0) {
    throw new ErroHttp(400, "O pedido precisa ter ao menos um item.");
  }
  const quantidades = new Map<string, number>();
  for (const item of itensEntrada as { produtoId?: unknown; quantidade?: unknown }[]) {
    const produtoId = resolverId(String(item?.produtoId ?? "")).toLowerCase();
    const quantidade = Number(item?.quantidade);
    if (!ehUuid(produtoId)) throw new ErroHttp(400, "Produto inválido no pedido.");
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) {
      throw new ErroHttp(400, "Quantidade inválida no pedido.");
    }
    quantidades.set(produtoId, (quantidades.get(produtoId) ?? 0) + quantidade);
  }
  return quantidades;
}

export async function criarPedido(compradorIdBruto: string, itensEntrada: unknown, chave?: string): Promise<PedidoComItens> {
  const compradorId = resolverId(String(compradorIdBruto ?? ""));
  if (!ehUuid(compradorId)) throw new ErroHttp(400, "Comprador inválido.");
  const quantidades = validarItens(itensEntrada);
  if (chave !== undefined && !ehUuid(chave)) throw new ErroHttp(400, "Informe uma chave de idempotência UUID válida.");
  const itensCanonicos = assinaturaItens([...quantidades].map(([produtoId, quantidade]) => ({ produtoId, quantidade })));
  const tentativaId = idDoPedido(compradorId, chave);

  return emTransacao(async (tx) => {
    if (!(await usuarioRepository.ehComprador(compradorId, tx))) {
      throw new ErroHttp(404, "Comprador não encontrado.");
    }

    await pedidoRepository.travarTentativa(tentativaId, tx);
    const anterior = await pedidoRepository.buscarPorId(tentativaId, tx);
    if (anterior) {
      if (anterior.compradorId.toLowerCase() !== compradorId.toLowerCase() ||
          assinaturaItens(anterior.itens) !== itensCanonicos) throw new ErroHttp(409, "Esta chave já foi usada para outro carrinho.");
      return anterior;
    }

    const ids = Array.from(quantidades.keys());
    const produtos = await produtoRepository.travarParaCompra(ids, tx);
    if (produtos.length !== ids.length) throw new ErroHttp(404, "Produto não encontrado.");

    let totalCentavos = 0;
    for (const p of produtos) {
      const qtd = quantidades.get(p.id) as number;
      if (p.estoque < qtd) {
        throw new ErroHttp(
          409,
          p.estoque === 0 ? `"${p.nome}" está esgotado.` : `Só restam ${p.estoque} unidade(s) de "${p.nome}".`
        );
      }
      totalCentavos += Math.round(Number(p.preco) * 100) * qtd;
    }

    const id = await pedidoRepository.inserir(compradorId, totalCentavos, tx, tentativaId);
    for (const p of produtos) {
      const qtd = quantidades.get(p.id) as number;
      await pedidoRepository.inserirItem(id, p.id, qtd, p.preco, tx);
      await produtoRepository.baixarEstoque(p.id, qtd, tx);
    }
    // Ler antes do COMMIT evita sinalizar falha após uma gravação bem-sucedida
    // apenas porque a consulta usada para montar a resposta falhou.
    const criado = await pedidoRepository.buscarPorId(id, tx);
    if (!criado) throw new ErroHttp(404, "Pedido não encontrado.");
    return criado;
  });
}

export async function atualizarStatus(
  idBruto: string,
  status: unknown,
  sessao: DadosSessao
): Promise<PedidoComItens> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) throw new ErroHttp(404, "Pedido não encontrado.");
  if (!STATUS_PEDIDO.includes(status as StatusPedido)) throw new ErroHttp(400, "Status inválido.");

  if (sessao.tipo !== "admin") {
    // Artesão só marca como enviado, e só pedidos que contêm produto dele.
    if (sessao.tipo !== "artesao" || status !== "enviado") {
      throw new ErroHttp(403, "Seu perfil não pode alterar o pedido para este status.");
    }
    if (!(await pedidoRepository.contemProdutoDoArtesao(id, sessao.id))) {
      throw new ErroHttp(403, "Este pedido não contém produtos seus.");
    }
  }

  if (!(await pedidoRepository.atualizarStatus(id, status as StatusPedido))) {
    throw new ErroHttp(404, "Pedido não encontrado.");
  }
  const pedido = await pedidoRepository.buscarPorId(id);
  if (!pedido) throw new ErroHttp(404, "Pedido não encontrado.");
  return pedido;
}
