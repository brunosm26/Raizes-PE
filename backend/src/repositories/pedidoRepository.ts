import type { ItemPedidoComProduto, PedidoComItens, StatusPedido } from "../types/dominio";
import { executorPadrao, type Executor } from "./transacao";

// Acesso a origem.pedido e origem.item_pedido. Pedido e itens são gravados na MESMA
// transação: o banco confere, no COMMIT, que valor_total = soma dos itens
// (constraint triggers deferidos do modelo físico).

interface LinhaPedido {
  id: string;
  compradorId: string;
  compradorNome: string;
  dataPedido: string;
  status: StatusPedido;
  valorTotal: number;
}

async function carregar(
  filtroSql: string,
  valores: unknown[],
  executor: Executor = executorPadrao()
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

  const { rows: itens } = await executor.query<ItemPedidoComProduto>(
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

  const porPedido = new Map<string, ItemPedidoComProduto[]>();
  for (const item of itens) {
    const lista = porPedido.get(item.pedidoId) ?? [];
    lista.push(item);
    porPedido.set(item.pedidoId, lista);
  }
  return pedidos.map((p) => ({ ...p, itens: porPedido.get(p.id) ?? [] }));
}

export function listarTodos(): Promise<PedidoComItens[]> {
  return carregar("", []);
}

export function listarDoComprador(compradorId: string): Promise<PedidoComItens[]> {
  return carregar("WHERE pe.comprador_id = $1", [compradorId]);
}

// Pedidos que têm ao menos um item de produto deste artesão (painel do artesão).
export function listarDoArtesao(usuarioId: string): Promise<PedidoComItens[]> {
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

export async function buscarPorId(id: string, executor?: Executor): Promise<PedidoComItens | null> {
  const [pedido] = await carregar("WHERE pe.id = $1", [id], executor);
  return pedido ?? null;
}

export async function inserir(compradorId: string, totalCentavos: number, tx: Executor): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `INSERT INTO origem.pedido (comprador_id, status, valor_total)
     VALUES ($1, 'pendente', $2::numeric / 100) RETURNING id`,
    [compradorId, totalCentavos]
  );
  return rows[0]!.id;
}

export async function inserirItem(
  pedidoId: string,
  produtoId: string,
  quantidade: number,
  precoUnitario: string,
  tx: Executor
): Promise<void> {
  await tx.query(
    `INSERT INTO origem.item_pedido (pedido_id, produto_id, quantidade, preco_unitario)
     VALUES ($1, $2, $3, $4::numeric)`,
    [pedidoId, produtoId, quantidade, precoUnitario]
  );
}

export async function contemProdutoDoArtesao(pedidoId: string, usuarioId: string): Promise<boolean> {
  const { rows } = await executorPadrao().query(
    `SELECT 1
       FROM origem.item_pedido ip
       JOIN origem.produto p ON p.id = ip.produto_id
       JOIN origem.artesao a ON a.id = p.artesao_id
      WHERE ip.pedido_id = $1 AND a.usuario_id = $2
      LIMIT 1`,
    [pedidoId, usuarioId]
  );
  return rows.length > 0;
}

// Devolve false se o pedido não existe.
export async function atualizarStatus(id: string, status: StatusPedido): Promise<boolean> {
  const { rowCount } = await executorPadrao().query(`UPDATE origem.pedido SET status = $2 WHERE id = $1`, [
    id,
    status,
  ]);
  return Boolean(rowCount);
}
