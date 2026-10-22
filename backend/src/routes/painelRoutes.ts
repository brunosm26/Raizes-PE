import { Router } from "express";
import * as painelController from "../controllers/painelController";
import { exigirSessao } from "../middlewares/sessao";

export const painelRoutes = Router();

painelRoutes.get("/estatisticas", exigirSessao(["artesao", "admin"]), painelController.estatisticas);
