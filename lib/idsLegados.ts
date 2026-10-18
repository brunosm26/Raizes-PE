// Utilitários de id que podem rodar no navegador e no servidor (sem importar o banco).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(valor: string): boolean {
  return UUID.test(valor);
}

// Ids antigos do mock ("p1", "a2", "u3"...) ainda existem em links salvos, no
// localStorage e no que o front ainda gera. Eles apontam para os UUIDs fixos da
// carga db/05_dados_raizes_pe.sql (prefixo da tabela + número do mock).
const PREFIXO_LEGADO: Record<string, string> = { u: "1", a: "2", p: "3" };

export function resolverId(id: string): string {
  if (ehUuid(id)) return id;
  const m = /^([uap])(\d{1,6})$/.exec(id);
  if (!m) return id;
  return `${PREFIXO_LEGADO[m[1]]}0000000-0000-4000-8000-${m[2].padStart(12, "0")}`;
}

// Número curto de pedido para exibir na tela (o id completo é um UUID).
export function numeroPedido(id: string): string {
  return `PED-${id.replace(/-/g, "").slice(-6).toUpperCase()}`;
}
