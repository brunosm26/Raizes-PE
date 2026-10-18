// Pedidos no PostgreSQL. Só roda no servidor (rotas /api/pedidos).
// pedido + item_pedido são gravados na MESMA transação: o banco confere, ao final,
// que valor_total = soma dos itens (constraint triggers deferidos do modelo físico).
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { ehUuid, resolverId } from "@/lib/idsLegados";
import type { DadosSessao } from "@/lib/sessao";
import type { ItemPedidoComProduto, PedidoComItens, StatusPedido, Tecnica } from "@/lib/tipos";

export class ErroPedido extends Error {
  constructor(mensagem: string, public status = 400) {
    super(mensagem);
  }
}

export const STATUS_VALIDOS: StatusPedido[] = ["pendente", "pago", "enviado", "entregue"];

interface LinhaPedido {
  id: string;
  compradorId: string;
  compradorNome: string;
  dataPedido: string;
  status: StatusPedido;
  valorTotal: number;
}

interface LinhaItem extends Omit<ItemPedidoComProduto, "produtoTecnica"> {
  produtoTecnica: Tecnica;
}

async function carregar(
  filtroSql: string,
  valores: unknown[],
  executor: Pick<PoolClient, "query"> = pool
): Promise<PedidoComItens[]> {
  const { rows: pedidos } = await executor.query<LinhaPedido>(
    `SELECT pe.id,
            pe.comprador_id                         AS "compradorId",
            u.nome                                  AS "compradorNome",
            to_char(pe.data_pedido, 'YYYY-MM-DD')   AS "dataPedido",
            pe.status,
            pe.valor_total::float8                  AS "valorTotal"
       FROM origem.pedido pe
       JOIN origem.usuario u ON u.id = pe.comprador_id
      ${filtroSql}
      ORDER BY pe.data_pedido DESC, pe.id DESC`,
    valores
  );
  if (pedidos.length === 0) return [];

  const { rows: itens } = await executor.query<LinhaItem>(
    `SELECT ip.id,
            ip.pedido_id                AS "pedidoId",
            ip.produto_id               AS "produtoId",
            ip.quantidade,
            ip.preco_unitario::float8   AS "precoUnitario",
            p.nome                      AS "produtoNome",
            p.tecnica                   AS "produtoTecnica",
            a.usuario_id                AS "artesaoUsuarioId",
            ua.nome                     AS "artesaoNome"
       FROM origem.item_pedido ip
       JOIN origem.produto p  ON p.id = ip.produto_id
       JOIN origem.artesao a  ON a.id = p.artesao_id
       JOIN origem.usuario ua ON ua.id = a.usuario_id
      WHERE ip.pedido_id = ANY($1::uuid[])
      ORDER BY p.nome, ip.id`,
    [pedidos.map((p) => p.id)]
  );

  const porPedido = new Map<string, LinhaItem[]>();
  for (const item of itens) {
    const lista = porPedido.get(item.pedidoId) ?? [];
    lista.push(item);
    porPedido.set(item.pedidoId, lista);
  }
  return pedidos.map((p) => ({ ...p, itens: porPedido.get(p.id) ?? [] }));
}

export async function listarPedidos(compradorIdBruto?: string): Promise<PedidoComItens[]> {
  if (!compradorIdBruto) return carregar("", []);
  const compradorId = resolverId(compradorIdBruto);
  if (!ehUuid(compradorId)) return [];
  return carregar("WHERE pe.comprador_id = $1", [compradorId]);
}

// Pedidos que têm ao menos um item de produto deste artesão (painel do artesão).
export async function listarPedidosDoArtesao(usuarioId: string): Promise<PedidoComItens[]> {
  return carregar(
    `WHERE pe.id IN (
       SELECT ip.pedido_id
         FROM origem.item_pedido ip
         JOIN origem.produto p ON p.id = ip.produto_id
         JOIN origem.artesao a ON a.id = p.artesao_id
        WHERE a.usuario_id = $1)`,
    [usuarioId]
  );
}

export async function criarPedido(
  compradorIdBruto: string,
  itensEntrada: { produtoId: string; quantidade: number }[]
): Promise<PedidoComItens> {
  const compradorId = resolverId(String(compradorIdBruto ?? ""));
  if (!ehUuid(compradorId)) throw new ErroPedido("Comprador inválido.");
  if (!Array.isArray(itensEntrada) || itensEntrada.length === 0) {
    throw new ErroPedido("O pedido precisa ter ao menos um item.");
  }

  // Junta linhas repetidas do mesmo produto e valida as quantidades.
  const quantidades = new Map<string, number>();
  for (const item of itensEntrada) {
    const produtoId = resolverId(String(item?.produtoId ?? ""));
    const quantidade = Number(item?.quantidade);
    if (!ehUuid(produtoId)) throw new ErroPedido("Produto inválido no pedido.");
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 99) {
      throw new ErroPedido("Quantidade inválida no pedido.");
    }
    quantidades.set(produtoId, (quantidades.get(produtoId) ?? 0) + quantidade);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: compradores } = await client.query(
      `SELECT 1 FROM origem.usuario WHERE id = $1 AND tipo = 'comprador'`,
      [compradorId]
    );
    if (compradores.length === 0) throw new ErroPedido("Comprador não encontrado.", 404);

    // Trava as linhas dos produtos para duas compras simultâneas não estourarem o estoque.
    const ids = Array.from(quantidades.keys());
    const { rows: produtos } = await client.query<{
      id: string;
      nome: string;
      preco: string;
      estoque: number;
    }>(
      `SELECT id, nome, preco::text AS preco, estoque_qtd AS estoque
         FROM origem.produto
        WHERE id = ANY($1::uuid[])
        ORDER BY id
        FOR UPDATE`,
      [ids]
    );
    if (produtos.length !== ids.length) throw new ErroPedido("Produto não encontrado.", 404);

    let totalCentavos = 0;
    for (const p of produtos) {
      const qtd = quantidades.get(p.id) as number;
      if (p.estoque < qtd) {
        throw new ErroPedido(
          p.estoque === 0
            ? `"${p.nome}" está esgotado.`
            : `Só restam ${p.estoque} unidade(s) de "${p.nome}".`,
          409
        );
      }
      totalCentavos += Math.round(Number(p.preco) * 100) * qtd;
    }

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO origem.pedido (comprador_id, status, valor_total)
       VALUES ($1, 'pendente', $2::numeric / 100) RETURNING id`,
      [compradorId, totalCentavos]
    );
    const pedidoId = rows[0].id;

    for (const p of produtos) {
      const qtd = quantidades.get(p.id) as number;
      await client.query(
        `INSERT INTO origem.item_pedido (pedido_id, produto_id, quantidade, preco_unitario)
         VALUES ($1, $2, $3, $4::numeric)`,
        [pedidoId, p.id, qtd, p.preco]
      );
      await client.query(
        `UPDATE origem.produto SET estoque_qtd = estoque_qtd - $2 WHERE id = $1`,
        [p.id, qtd]
      );
    }

    await client.query("COMMIT");
    const [criado] = await carregar("WHERE pe.id = $1", [pedidoId], client);
    return criado;
  } catch (erro) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    client.release();
  }
}

export async function atualizarStatus(
  idBruto: string,
  status: string,
  sessao: DadosSessao
): Promise<PedidoComItens> {
  const id = resolverId(idBruto);
  if (!ehUuid(id)) throw new ErroPedido("Pedido não encontrado.", 404);
  if (!STATUS_VALIDOS.includes(status as StatusPedido)) throw new ErroPedido("Status inválido.");

  if (sessao.tipo !== "admin") {
    // Artesão só marca como enviado, e só pedidos que contêm produto dele.
    if (sessao.tipo !== "artesao" || status !== "enviado") {
      throw new ErroPedido("Seu perfil não pode alterar o pedido para este status.", 403);
    }
    const { rows } = await pool.query(
      `SELECT 1
         FROM origem.item_pedido ip
         JOIN origem.produto p ON p.id = ip.produto_id
         JOIN origem.artesao a ON a.id = p.artesao_id
        WHERE ip.pedido_id = $1 AND a.usuario_id = $2
        LIMIT 1`,
      [id, sessao.id]
    );
    if (rows.length === 0) throw new ErroPedido("Este pedido não contém produtos seus.", 403);
  }

  const { rowCount } = await pool.query(`UPDATE origem.pedido SET status = $2 WHERE id = $1`, [
    id,
    status,
  ]);
  if (!rowCount) throw new ErroPedido("Pedido não encontrado.", 404);
  const [pedido] = await carregar("WHERE pe.id = $1", [id]);
  return pedido;
}
