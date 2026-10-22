import { Router } from "express";
import * as produtoController from "../controllers/produtoController";
import { exigirSessao } from "../middlewares/sessao";

export const produtoRoutes = Router();

produtoRoutes.get("/", produtoController.listar);
produtoRoutes.post("/", exigirSessao(["artesao"]), produtoController.criar);
produtoRoutes.get("/:id", produtoController.buscar);
produtoRoutes.patch("/:id", exigirSessao(["artesao", "admin"]), produtoController.editar);
produtoRoutes.get("/:id/relacionados", produtoController.relacionados);
produtoRoutes.get("/:id/avaliacoes", produtoController.avaliacoes);
