import type { RequestHandler } from "express";
import { sessaoDe } from "../middlewares/sessao";
import { invalidarCatalogo } from "../services/cacheCatalogo";
import * as artesaoService from "../services/artesaoService";
import * as catalogoService from "../services/catalogoService";
import { ErroHttp } from "../utils/erroHttp";

// GET /api/artesaos (só admin: o exigirSessao da rota já barrou os outros perfis)
export const listar: RequestHandler = async (_req, res) => {
  res.json(await artesaoService.listarParaAdmin());
};

// GET /api/artesaos/:id
export const buscarPerfil: RequestHandler<{ id: string }> = async (req, res) => {
  const perfil = await catalogoService.buscarPerfilArtesao(req.params.id);
  if (!perfil) throw new ErroHttp(404, "Artesão não encontrado");
  res.json(perfil);
};

export const buscarMeuPerfil: RequestHandler = async (req, res) => {
  res.json(await artesaoService.buscarMeuPerfil(sessaoDe(req).id));
};

export const editarMeuPerfil: RequestHandler = async (req, res) => {
  const perfil = await artesaoService.editarMeuPerfil(sessaoDe(req).id, req.body ?? {});
  invalidarCatalogo();
  res.json(perfil);
};
