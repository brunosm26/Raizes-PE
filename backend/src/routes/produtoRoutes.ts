import { Router } from "express";
import * as produtoController from "../controllers/produtoController";
import { exigirSessao } from "../middlewares/sessao";

export const produtoRoutes = Router();

produtoRoutes.get(
  "/",
  (req, _res, next) => next(req.query.visao === "gestao" ? undefined : "route"),
  exigirSessao(["artesao", "admin"]),
  produtoController.listarParaGestao
);
produtoRoutes.get("/", produtoController.listar);
produtoRoutes.post("/", exigirSessao(["artesao"]), produtoController.criar);
produtoRoutes.get("/:id", produtoController.buscar);
produtoRoutes.patch("/:id", exigirSessao(["artesao", "admin"]), produtoController.editar);
produtoRoutes.get("/:id/relacionados", produtoController.relacionados);
produtoRoutes.get("/:id/avaliacoes", produtoController.avaliacoes);

produtoRoutes.patch("/:id/curadoria", exigirSessao(["admin"]), produtoController.moderar);
