import { Router } from "express";
import * as recomendacaoController from "../controllers/recomendacaoController";
import { carregarSessao } from "../middlewares/sessao";

export const recomendacaoRoutes = Router();

recomendacaoRoutes.get("/", carregarSessao, recomendacaoController.listar);
