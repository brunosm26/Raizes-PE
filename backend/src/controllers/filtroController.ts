import type { RequestHandler } from "express";
import * as filtroService from "../services/filtroService";

// GET /api/filtros (público)
export const listar: RequestHandler = async (_req, res) => {
  res.json(await filtroService.obterOpcoes());
};
