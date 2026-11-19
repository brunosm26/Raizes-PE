import { env } from "../config/env";
import { CacheMemoria } from "../utils/cacheMemoria";

// Um cache só para as três leituras públicas mais chamadas da vitrine: GET /filtros,
// GET /produtos e GET /recomendacoes. Elas dependem das mesmas tabelas (produto, estoque,
// pedidos e avaliações), então qualquer escrita nessas tabelas apaga o cache inteiro
// (invalidarCatalogo). Apagar tudo é barato e evita errar qual chave a escrita afetou.
export const cacheCatalogo = new CacheMemoria({ ttlMs: env.CACHE_TTL_SEGUNDOS * 1000 });

export const CHAVE_FILTROS = "filtros";

export interface FiltrosProdutos {
  tecnica?: string;
  regiao?: string;
  categoria?: string;
  busca?: string;
}

// Chave canônica: os campos saem sempre na mesma ordem, então ?regiao=X&tecnica=Y e
// ?tecnica=Y&regiao=X caem na mesma entrada. Parâmetro ausente e vazio (?busca=) ficam
// separados porque o service pode tratá-los de forma diferente.
export function chaveProdutos(filtros: FiltrosProdutos): string {
  const campos = [filtros.tecnica, filtros.regiao, filtros.categoria, filtros.busca];
  return `produtos:${JSON.stringify(campos.map((v) => v ?? null))}`;
}

// O comprador vem da sessão (nunca da URL): cada comprador tem a própria entrada, e visitante
// ou outro perfil cai em "anonimo", que é o cold start igual para todos.
export function chaveRecomendacoes(compradorId: string | undefined, limite: number): string {
  return `recomendacoes:${compradorId ?? "anonimo"}:${limite}`;
}

export function invalidarCatalogo(): void {
  cacheCatalogo.limpar();
}
