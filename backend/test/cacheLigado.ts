// Importado ANTES do ajudantes por cacheCatalogo*.test.ts: o ajudantes deixa o cache desligado
// (TTL 0) para as outras suítes, e o config/env lê o TTL uma vez, quando é carregado.
process.env.CACHE_TTL_SEGUNDOS = "60";
export const TTL_MS = 60_000;
