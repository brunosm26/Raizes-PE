import type { Response } from "express";
import type { OrigemCache } from "../utils/cacheMemoria";

// `X-Cache` diz se a resposta veio da memória (HIT) ou do PostgreSQL (MISS).
// `private, no-cache` faz o navegador revalidar sempre com a API (nada de cache de disco nem
// de proxy compartilhado), então cada F5 aparece na aba Network com o X-Cache do servidor.
export function enviarComCache(res: Response, origem: OrigemCache, corpo: unknown): void {
  res.setHeader("X-Cache", origem);
  res.setHeader("Cache-Control", "private, no-cache");
  res.json(corpo);
}
