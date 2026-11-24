import { Router } from "express";
import * as atividadeAdminController from "../controllers/atividadeAdminController";
import { exigirSessao } from "../middlewares/sessao";

export const atividadeAdminRoutes = Router();

atividadeAdminRoutes.get("/", exigirSessao(["admin"]), atividadeAdminController.listar);
atividadeAdminRoutes.patch("/:tipo/:id", exigirSessao(["admin"]), atividadeAdminController.alterar);
