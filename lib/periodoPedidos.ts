export interface PeriodoPedidos {
  inicio?: string;
  fim?: string;
}

function dataValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor.startsWith("0000")) return false;
  const data = new Date(valor + "T00:00:00Z");
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function lerPeriodoPedidos(inicio: unknown, fim: unknown): PeriodoPedidos | null {
  if (inicio !== undefined && !dataValida(inicio)) return null;
  if (fim !== undefined && !dataValida(fim)) return null;
  if (inicio !== undefined && fim !== undefined && inicio > fim) return null;
  return { inicio, fim };
}
