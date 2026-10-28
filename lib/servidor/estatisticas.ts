// Números do painel do artesão, calculados a partir dos pedidos reais no banco.
import { pool } from "@/lib/db";
import type { EstatisticasPainel } from "@/lib/tipos";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Soma por mês só dos itens deste artesão (um pedido pode misturar vários artesãos).
export async function estatisticasDoArtesao(usuarioId: string): Promise<EstatisticasPainel> {
  const { rows: porMes } = await pool.query<{ mes: string; faturamento: number; pedidos: number }>(
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
  const mapa = new Map(porMes.map((r) => [r.mes, r]));

  // Âncora: o mês da venda mais recente (ou o mês atual, se ainda não há vendas). Assim o
  // gráfico mostra os 6 últimos meses de atividade e "vendas do mês" é o mês mais recente.
  const ultimo = porMes.map((r) => r.mes).sort().at(-1);
  const hoje = new Date();
  const [anoAncora, mesAncora] = ultimo
    ? ultimo.split("-").map(Number)
    : [hoje.getFullYear(), hoje.getMonth() + 1];

  const historicoMensal = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(anoAncora, mesAncora - 1 - (5 - i), 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const linha = mapa.get(chave);
    return {
      mes: MESES[d.getMonth()],
      faturamento: Math.round((linha?.faturamento ?? 0) * 100) / 100,
      pedidos: linha?.pedidos ?? 0,
    };
  });

  const atual = historicoMensal[5].faturamento;
  const anterior = historicoMensal[4].faturamento;
  const vendasDeltaPct = anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : 0;

  const { rows: tecnicas } = await pool.query<{ tecnica: string; totalVendido: number }>(
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
  const total = tecnicas.reduce((s, t) => s + t.totalVendido, 0);
  const vendasPorTecnica = tecnicas.map((t) => ({
    tecnica: t.tecnica,
    totalVendido: Math.round(t.totalVendido * 100) / 100,
    porcentagem: total > 0 ? Math.round((t.totalVendido / total) * 100) : 0,
  }));

  const { rows: pend } = await pool.query<{ n: number }>(
    `SELECT COUNT(DISTINCT pe.id)::int AS n
       FROM origem.pedido pe
       JOIN origem.item_pedido ip ON ip.pedido_id = pe.id
       JOIN origem.produto p ON p.id = ip.produto_id
       JOIN origem.artesao a ON a.id = p.artesao_id
      WHERE a.usuario_id = $1 AND pe.status = 'pendente'`,
    [usuarioId]
  );

  return {
    vendasDoMes: atual,
    vendasDeltaPct,
    pedidosPendentes: pend[0].n,
    historicoMensal,
    vendasPorTecnica,
  };
}
