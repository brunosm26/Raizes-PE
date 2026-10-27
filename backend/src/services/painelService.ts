import * as estatisticaRepository from "../repositories/estatisticaRepository";
import type { EstatisticasPainel, PontoSerieVendas } from "../types/dominio";

// Números do painel do artesão, calculados a partir dos pedidos reais.

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const centavos = (valor: number) => Math.round(valor * 100) / 100;

export async function estatisticasDoArtesao(usuarioId: string): Promise<EstatisticasPainel> {
  const [porMes, tecnicas, pedidosPendentes] = await Promise.all([
    estatisticaRepository.vendasPorMes(usuarioId),
    estatisticaRepository.vendasPorTecnica(usuarioId),
    estatisticaRepository.contarPedidosPendentes(usuarioId),
  ]);
  const mapa = new Map(porMes.map((r) => [r.mes, r]));

  // Âncora: o mês da venda mais recente (ou o mês atual, se ainda não há vendas). Assim o
  // gráfico mostra os 6 últimos meses de atividade e "vendas do mês" é o mês mais recente.
  const ultimo = porMes.map((r) => r.mes).sort().at(-1);
  const hoje = new Date();
  const [anoAncora, mesAncora] = ultimo ? ultimo.split("-").map(Number) : [hoje.getFullYear(), hoje.getMonth() + 1];

  const historicoMensal: PontoSerieVendas[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(anoAncora!, mesAncora! - 1 - (5 - i), 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const linha = mapa.get(chave);
    return {
      mes: MESES[d.getMonth()]!,
      faturamento: centavos(linha?.faturamento ?? 0),
      pedidos: linha?.pedidos ?? 0,
    };
  });

  const atual = historicoMensal[5]!.faturamento;
  const anterior = historicoMensal[4]!.faturamento;
  const vendasDeltaPct = anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : 0;

  const total = tecnicas.reduce((s, t) => s + t.totalVendido, 0);
  const vendasPorTecnica = tecnicas.map((t) => ({
    tecnica: t.tecnica,
    totalVendido: centavos(t.totalVendido),
    porcentagem: total > 0 ? Math.round((t.totalVendido / total) * 100) : 0,
  }));

  return { vendasDoMes: atual, vendasDeltaPct, pedidosPendentes, historicoMensal, vendasPorTecnica };
}
