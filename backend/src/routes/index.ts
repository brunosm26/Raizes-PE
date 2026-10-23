import { Router } from "express";
import { artesaoRoutes } from "./artesaoRoutes";
import { authRoutes } from "./authRoutes";
import { painelRoutes } from "./painelRoutes";
import { pedidoRoutes } from "./pedidoRoutes";
import { produtoRoutes } from "./produtoRoutes";
import { recomendacaoRoutes } from "./recomendacaoRoutes";
import { saudeBdRoutes, saudeRoutes } from "./saudeRoutes";

// Reúne todas as rotas da API. O app monta este router em /api.
export const rotas = Router();

rotas.use("/saude", saudeRoutes);
rotas.use("/saude-bd", saudeBdRoutes);
rotas.use("/auth", authRoutes);
rotas.use("/produtos", produtoRoutes);
rotas.use("/artesaos", artesaoRoutes);
rotas.use("/pedidos", pedidoRoutes);
rotas.use("/recomendacoes", recomendacaoRoutes);
rotas.use("/painel", painelRoutes);
