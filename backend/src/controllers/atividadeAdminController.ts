import type { RequestHandler } from "express";
import { alterarAtividade, listarAtividade } from "../services/atividadeAdminService";

export const listar: RequestHandler = async (_req, res) => {
  res.set("Cache-Control", "no-store").json(await listarAtividade());
};

export const alterar: RequestHandler<{ tipo: string; id: string }> = async (req, res) => {
  await alterarAtividade(req.params.tipo, req.params.id, req.body);
  res.status(204).end();
};
