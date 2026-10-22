import { Router } from "express";
import { pedidoRoutes } from "./pedidoRoutes";
import { produtoRoutes } from "./produtoRoutes";
import { saudeRoutes } from "./saudeRoutes";

// Reúne todas as rotas da API. O app monta este router em /api.
export const rotas = Router();

rotas.use("/saude", saudeRoutes);
rotas.use("/pedidos", pedidoRoutes);
rotas.use("/produtos", produtoRoutes);
