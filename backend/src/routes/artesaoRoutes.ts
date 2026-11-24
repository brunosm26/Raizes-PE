import { Router } from "express";
import * as artesaoController from "../controllers/artesaoController";
import { exigirSessao } from "../middlewares/sessao";

export const artesaoRoutes = Router();

artesaoRoutes.get("/", exigirSessao(["admin"]), artesaoController.listar);
artesaoRoutes.get("/me", exigirSessao(["artesao"]), artesaoController.buscarMeuPerfil);
artesaoRoutes.patch("/me", exigirSessao(["artesao"]), artesaoController.editarMeuPerfil);
artesaoRoutes.get("/:id", artesaoController.buscarPerfil);
