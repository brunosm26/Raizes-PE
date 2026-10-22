import { Router } from "express";
import { saudeRoutes } from "./saudeRoutes";

// Reúne todas as rotas da API. O app monta este router em /api.
export const rotas = Router();

rotas.use("/saude", saudeRoutes);
