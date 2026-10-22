import { Router } from "express";
import * as produtoController from "../controllers/produtoController";
import { exigirSessao } from "../middlewares/sessao";

export const produtoRoutes = Router();

produtoRoutes.post("/", exigirSessao(["artesao"]), produtoController.criar);
produtoRoutes.patch("/:id", exigirSessao(["artesao", "admin"]), produtoController.editar);
