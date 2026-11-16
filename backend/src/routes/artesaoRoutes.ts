import { Router } from "express";
import * as artesaoController from "../controllers/artesaoController";
import { exigirSessao } from "../middlewares/sessao";

export const artesaoRoutes = Router();

artesaoRoutes.get("/", exigirSessao(["admin"]), artesaoController.listar);
artesaoRoutes.get("/:id", artesaoController.buscarPerfil);
