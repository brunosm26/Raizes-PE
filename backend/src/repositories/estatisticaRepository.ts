import { executorPadrao } from "./transacao";

// Consultas de vendas do artesão (painel). Só somam os itens dele: um pedido pode
// misturar produtos de vários artesãos.

export async function vendasPorMes(
  usuarioId: string
): Promise<{ mes: string; faturamento: number; pedidos: number }[]> {
  const { rows } = await executorPadrao().query<{ mes: string; faturamento: number; pedidos: number }>(
    `SELECT to_char(date_trunc('month', pe.data_pedido), 'YYYY-MM') AS mes,
            SUM(ip.quantidade * ip.preco_unitario)::float8           AS faturamento,
            COUNT(DISTINCT pe.id)::int                               AS pedidos
       FROM origem.item_pedido ip
       JOIN origem.pedido pe  ON pe.id = ip.pedido_id
       JOIN origem.produto p  ON p.id = ip.produto_id
       JOIN origem.artesao a  ON a.id = p.artesao_id
      WHERE a.usuario_id = $1
      GROUP BY 1`,
    [usuarioId]
  );
  return rows;
}

export async function vendasPorTecnica(usuarioId: string): Promise<{ tecnica: string; totalVendido: number }[]> {
  const { rows } = await executorPadrao().query<{ tecnica: string; totalVendido: number }>(
    `SELECT COALESCE(p.tecnica, 'Outras')                  AS tecnica,
            SUM(ip.quantidade * ip.preco_unitario)::float8 AS "totalVendido"
       FROM origem.item_pedido ip
       JOIN origem.produto p ON p.id = ip.produto_id
       JOIN origem.artesao a ON a.id = p.artesao_id
      WHERE a.usuario_id = $1
      GROUP BY 1
      ORDER BY 2 DESC`,
    [usuarioId]
  );
  return rows;
}

export async function contarPedidosPendentes(usuarioId: string): Promise<number> {
  const { rows } = await executorPadrao().query<{ n: number }>(
    `SELECT COUNT(DISTINCT pe.id)::int AS n
       FROM origem.pedido pe
       JOIN origem.item_pedido ip ON ip.pedido_id = pe.id
       JOIN origem.produto p ON p.id = ip.produto_id
       JOIN origem.artesao a ON a.id = p.artesao_id
      WHERE a.usuario_id = $1 AND pe.status = 'pendente'`,
    [usuarioId]
  );
  return rows[0]?.n ?? 0;
}
