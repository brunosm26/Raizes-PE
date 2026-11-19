import type { RequestHandler } from "express";
import { cacheCatalogo, CHAVE_FILTROS } from "../services/cacheCatalogo";
import * as filtroService from "../services/filtroService";
import { enviarComCache } from "./respostaCache";

// GET /api/filtros (público, com cache: X-Cache HIT/MISS)
export const listar: RequestHandler = async (_req, res) => {
  const { valor, origem } = await cacheCatalogo.lerOuCalcular(CHAVE_FILTROS, () => filtroService.obterOpcoes());
  enviarComCache(res, origem, valor);
};
