import { Router } from "express";
import * as pedidoController from "../controllers/pedidoController";
import { exigirSessao } from "../middlewares/sessao";

export const pedidoRoutes = Router();

pedidoRoutes.get("/", exigirSessao(), pedidoController.listar);
pedidoRoutes.post("/", exigirSessao(["comprador"]), pedidoController.criar);
// Artesão (só "enviado", só pedido dele) ou admin
pedidoRoutes.patch("/:id", exigirSessao(["artesao", "admin"]), pedidoController.atualizarStatus);
