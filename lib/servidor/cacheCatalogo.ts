// Cache das leituras do catálogo no fallback do Next (sem API_URL). Mesmas chaves, mesmo TTL
// e mesma invalidação do Express (backend/src/services/cacheCatalogo.ts). A classe é cópia de
// backend/src/utils/cacheMemoria.ts (tests/cacheNext.test.mjs confere que não divergem).
import { CacheMemoria } from "@/lib/servidor/cacheMemoria";

const TTL_PADRAO = 60;
const TTL_MAXIMO = 86_400;

// Inválido não derruba as rotas: avisa e usa o padrão. O Express, que sobe à parte, recusa.
function lerTtlSegundos(valor: string | undefined): number {
  if (valor === undefined || valor.trim() === "") return TTL_PADRAO;
  const segundos = Number(valor);
  if (!/^\d+$/.test(valor.trim()) || segundos > TTL_MAXIMO) {
    console.warn(`CACHE_TTL_SEGUNDOS inválido: "${valor}". Usando ${TTL_PADRAO}s.`);
    return TTL_PADRAO;
  }
  return segundos;
}

// Um só cache entre os recarregamentos do modo de desenvolvimento, como o pool de lib/db.ts.
const g = globalThis as unknown as { cacheCatalogo?: CacheMemoria };

export const cacheCatalogo =
  g.cacheCatalogo ?? new CacheMemoria({ ttlMs: lerTtlSegundos(process.env.CACHE_TTL_SEGUNDOS) * 1000 });

if (process.env.NODE_ENV !== "production") g.cacheCatalogo = cacheCatalogo;

export const CHAVE_FILTROS = "filtros";

export function chaveProdutos(filtros: { tecnica?: string; regiao?: string; categoria?: string; busca?: string }): string {
  const campos = [filtros.tecnica, filtros.regiao, filtros.categoria, filtros.busca];
  return `produtos:${JSON.stringify(campos.map((v) => v ?? null))}`;
}

export function chaveRecomendacoes(compradorId: string | undefined, limite: number): string {
  return `recomendacoes:${compradorId ?? "anonimo"}:${limite}`;
}

export function invalidarCatalogo(): void {
  cacheCatalogo.limpar();
}

// X-Cache: HIT (memória) ou MISS (PostgreSQL); o navegador sempre revalida com a API.
export function cabecalhosCache(origem: "HIT" | "MISS"): Record<string, string> {
  return { "X-Cache": origem, "Cache-Control": "private, no-cache" };
}
