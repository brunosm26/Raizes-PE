import type { RequestHandler } from "express";
import * as catalogoService from "../services/catalogoService";
import { ErroHttp } from "../utils/erroHttp";

// GET /api/artesaos/:id
export const buscarPerfil: RequestHandler<{ id: string }> = async (req, res) => {
  const perfil = await catalogoService.buscarPerfilArtesao(req.params.id);
  if (!perfil) throw new ErroHttp(404, "Artesão não encontrado");
  res.json(perfil);
};
