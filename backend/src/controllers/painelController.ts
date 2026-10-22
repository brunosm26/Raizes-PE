import type { RequestHandler } from "express";
import { sessaoDe } from "../middlewares/sessao";
import { estatisticasDoArtesao } from "../services/painelService";

// GET /api/painel/estatisticas, do artesão logado (admin vê zerado: não tem loja)
export const estatisticas: RequestHandler = async (req, res) => {
  res.json(await estatisticasDoArtesao(sessaoDe(req).id));
};
